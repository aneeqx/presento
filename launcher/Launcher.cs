// Portable presentation launcher: one exe = this program + an AES-CTR encrypted payload appended after it.
// .NET Framework 4.x (built into Windows 10/11) + WebView2 (built into Windows 11). C# 5 on purpose: compiled with the csc that ships with Windows.
// Payload layout: see docs/EXE-FORMAT.md
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Reflection;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;

static class Entry
{
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern IntPtr LoadLibrary(string path);

    internal static string TempDir;

    static Assembly Resolve(object s, ResolveEventArgs a)
    {
        string n = new AssemblyName(a.Name).Name + ".dll";
        using (Stream st = Assembly.GetExecutingAssembly().GetManifestResourceStream(n))
        {
            if (st == null) return null;
            byte[] b = new byte[st.Length]; st.Read(b, 0, b.Length);
            return Assembly.Load(b);
        }
    }

    [STAThread]
    static int Main(string[] args)
    {
        AppDomain.CurrentDomain.AssemblyResolve += Resolve;
        try
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            TempDir = Path.Combine(Path.GetTempPath(), "pk_" + Convert.ToString(Path.GetFileName(Application.ExecutablePath).GetHashCode() & 0x7fffffff, 16));
            Directory.CreateDirectory(TempDir);
            ExtractLoader();
            return App.Run(args);
        }
        catch (Exception e)
        {
            MessageBox.Show("This presentation could not start.\n\n" + e.Message, "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return 1;
        }
    }

    static void ExtractLoader()
    {
        string dll = Path.Combine(TempDir, "WebView2Loader.dll");
        using (Stream st = Assembly.GetExecutingAssembly().GetManifestResourceStream("WebView2Loader.dll"))
        {
            if (!File.Exists(dll) || new FileInfo(dll).Length != st.Length)
            {
                using (FileStream f = new FileStream(dll, FileMode.Create, FileAccess.Write, FileShare.Read)) st.CopyTo(f);
            }
        }
        if (LoadLibrary(dll) == IntPtr.Zero) throw new Exception("WebView2 loader could not be loaded");
    }
}

/// <summary>The appended payload: header, optional gate page, encrypted region (index + files).</summary>
class Package
{
    public string ExePath;
    public long BlobStart, RegionStart, IndexLen, RegionLen;
    public uint Flags, Iters;
    public byte[] Salt, Iv, Check, Gate;
    public byte[] EncKey;
    public Dictionary<string, FileEnt> Files;
    public string Name, Bg;

    public class FileEnt { public long O, L; public string T; }

    public bool PinRequired { get { return (Flags & 1) != 0; } }

    public static Package Open(string exe)
    {
        Package p = new Package(); p.ExePath = exe;
        using (FileStream f = new FileStream(exe, FileMode.Open, FileAccess.Read, FileShare.Read))
        {
            if (f.Length < 200) throw new Exception("No presentation data in this file.");
            byte[] foot = new byte[24]; f.Position = f.Length - 24; f.Read(foot, 0, 24);
            if (Encoding.ASCII.GetString(foot, 16, 8) != "PKGEND01") throw new Exception("No presentation data in this file.");
            long blobLen = BitConverter.ToInt64(foot, 8);
            p.BlobStart = f.Length - 24 - blobLen;                       // relative to the end: works for the exe and for a detached payload file
            byte[] h = new byte[108]; f.Position = p.BlobStart; f.Read(h, 0, 108);
            if (Encoding.ASCII.GetString(h, 0, 8) != "PKG1BLOB") throw new Exception("Presentation data is damaged.");
            p.Flags = BitConverter.ToUInt32(h, 12); p.Iters = BitConverter.ToUInt32(h, 16);
            p.Salt = new byte[16]; Array.Copy(h, 24, p.Salt, 0, 16);
            p.Iv = new byte[16]; Array.Copy(h, 40, p.Iv, 0, 16);
            p.IndexLen = BitConverter.ToInt64(h, 56); p.RegionLen = BitConverter.ToInt64(h, 64);
            p.Check = new byte[32]; Array.Copy(h, 72, p.Check, 0, 32);
            int gl = (int)BitConverter.ToUInt32(h, 104);
            p.Gate = new byte[gl]; if (gl > 0) f.Read(p.Gate, 0, gl);
            p.RegionStart = p.BlobStart + 108 + gl;
        }
        return p;
    }

    /// <summary>Derives the keys from the PIN and decrypts the index. False = wrong PIN.</summary>
    public bool Unlock(string pin)
    {
        byte[] keys;
        using (Rfc2898DeriveBytes kdf = new Rfc2898DeriveBytes(pin, Salt, (int)Iters, HashAlgorithmName.SHA256)) keys = kdf.GetBytes(64);
        byte[] enc = new byte[32], mac = new byte[32];
        Array.Copy(keys, 0, enc, 0, 32); Array.Copy(keys, 32, mac, 0, 32);
        byte[] idx = new byte[IndexLen];
        using (CtrStream s = new CtrStream(this, enc, 0, IndexLen)) { int n = 0; while (n < idx.Length) { int r = s.Read(idx, n, idx.Length - n); if (r <= 0) break; n += r; } }
        byte[] calc;
        using (HMACSHA256 h = new HMACSHA256(mac)) calc = h.ComputeHash(idx);
        int diff = 0; for (int i = 0; i < 32; i++) diff |= calc[i] ^ Check[i];
        if (diff != 0) return false;
        EncKey = enc;
        JavaScriptSerializer js = new JavaScriptSerializer(); js.MaxJsonLength = int.MaxValue;
        Dictionary<string, object> root = js.Deserialize<Dictionary<string, object>>(Encoding.UTF8.GetString(idx));
        Name = root.ContainsKey("name") ? Convert.ToString(root["name"]) : "";
        Bg = root.ContainsKey("bg") ? Convert.ToString(root["bg"]) : null;
        Files = new Dictionary<string, FileEnt>();
        foreach (object o in (System.Collections.IEnumerable)root["files"])
        {
            Dictionary<string, object> d = (Dictionary<string, object>)o;
            FileEnt fe = new FileEnt(); fe.O = IndexLen + Convert.ToInt64(d["o"]); fe.L = Convert.ToInt64(d["l"]); fe.T = Convert.ToString(d["t"]);
            Files[Convert.ToString(d["p"])] = fe;
        }
        return true;
    }

    /// <summary>Quick check of the first bytes without a PIN (used to read the name/background of an unprotected package).</summary>
    public CtrStream Open(FileEnt e, long from, long length) { return new CtrStream(this, EncKey, e.O + from, length); }
}

/// <summary>Read-only stream over [offset, offset+length) of the encrypted region, decrypted on the fly (AES-256-CTR: random access, constant memory).</summary>
class CtrStream : Stream
{
    readonly Package p; readonly byte[] key; readonly long start, len; long pos;
    FileStream fs; ICryptoTransform ecb; Aes aes;
    readonly byte[] ctr = new byte[16];

    public CtrStream(Package p, byte[] key, long regionOffset, long length)
    {
        this.p = p; this.key = key; start = regionOffset; len = length;
    }

    void Init()
    {
        if (fs != null) return;
        fs = new FileStream(p.ExePath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite, 1 << 16, FileOptions.SequentialScan);
        aes = Aes.Create(); aes.Mode = CipherMode.ECB; aes.Padding = PaddingMode.None; aes.Key = key;
        ecb = aes.CreateEncryptor();
    }

    public override int Read(byte[] buffer, int offset, int count)
    {
        if (pos >= len) return 0;
        if (count > len - pos) count = (int)(len - pos);
        if (count > (1 << 20)) count = 1 << 20;
        Init();
        long abs = start + pos;
        long block = abs / 16; int skip = (int)(abs % 16);
        int nblocks = (skip + count + 15) / 16;
        byte[] cipher = new byte[nblocks * 16];
        fs.Position = p.RegionStart + abs - skip;
        int got = 0, want = Math.Min(cipher.Length, (int)(p.RegionLen - (abs - skip)));
        while (got < want) { int r = fs.Read(cipher, got, want - got); if (r <= 0) break; got += r; }
        byte[] counters = new byte[nblocks * 16];
        ulong hi = ToU64(p.Iv, 0), lo = ToU64(p.Iv, 8);
        ulong lo2 = lo + (ulong)block; ulong hi2 = hi + (lo2 < lo ? 1UL : 0UL);
        for (int i = 0; i < nblocks; i++)
        {
            PutU64(counters, i * 16, hi2); PutU64(counters, i * 16 + 8, lo2);
            lo2++; if (lo2 == 0) hi2++;
        }
        byte[] ks = new byte[counters.Length];
        ecb.TransformBlock(counters, 0, counters.Length, ks, 0);
        int n = Math.Min(count, Math.Max(0, got - skip));
        for (int i = 0; i < n; i++) buffer[offset + i] = (byte)(cipher[skip + i] ^ ks[skip + i]);
        pos += n;
        return n;
    }

    static ulong ToU64(byte[] b, int o) { ulong v = 0; for (int i = 0; i < 8; i++) v = (v << 8) | b[o + i]; return v; }
    static void PutU64(byte[] b, int o, ulong v) { for (int i = 7; i >= 0; i--) { b[o + i] = (byte)v; v >>= 8; } }

    public override bool CanRead { get { return true; } }
    public override bool CanSeek { get { return true; } }
    public override bool CanWrite { get { return false; } }
    public override long Length { get { return len; } }
    public override long Position { get { return pos; } set { pos = value; } }
    public override void Flush() { }
    public override long Seek(long o, SeekOrigin so) { pos = so == SeekOrigin.Begin ? o : so == SeekOrigin.Current ? pos + o : len + o; return pos; }
    public override void SetLength(long v) { throw new NotSupportedException(); }
    public override void Write(byte[] b, int o, int c) { throw new NotSupportedException(); }
    protected override void Dispose(bool d)
    {
        if (d) { if (fs != null) { fs.Dispose(); fs = null; } if (ecb != null) ecb.Dispose(); if (aes != null) aes.Dispose(); }
        base.Dispose(d);
    }
}

static class App
{
    [MethodImpl(MethodImplOptions.NoInlining)]
    public static int Run(string[] args)
    {
        bool windowed = Array.IndexOf(args, "--windowed") >= 0;
        string src = null;
        for (int i = 0; i + 1 < args.Length; i++) if (args[i] == "--payload") src = args[i + 1];       // test aid: an explicit data file
        string exe = Application.ExecutablePath, dir = Path.GetDirectoryName(exe);
        if (src == null)
        {
            string cand = Path.Combine(dir, Path.GetFileNameWithoutExtension(exe) + ".data");
            if (File.Exists(cand)) src = cand;
            else { string[] any = Directory.GetFiles(dir, "*.data"); if (any.Length == 1) src = any[0]; }       // exe renamed: use the one data file beside it
        }
        if (src == null)
        {
            Application.Run(new MissingData(Path.GetFileNameWithoutExtension(exe)));
            return 2;
        }
        Package pkg = Package.Open(src);
        if (!pkg.PinRequired) { if (!pkg.Unlock("")) throw new Exception("Presentation data is damaged."); }
        Viewer v = new Viewer(pkg, windowed);
        Application.Run(v);
        return 0;
    }
}

/// <summary>Shown when the data file is not beside the exe: a calm, styled message instead of a crash.</summary>
class MissingData : Form
{
    public MissingData(string name)
    {
        Text = name; FormBorderStyle = FormBorderStyle.FixedDialog; MaximizeBox = false; MinimizeBox = false; StartPosition = FormStartPosition.CenterScreen;
        ClientSize = new Size(620, 300); BackColor = ColorTranslator.FromHtml("#F9F9F7");
        Label t = new Label(); t.Text = name; t.Font = new Font("Segoe UI Light", 26f); t.ForeColor = ColorTranslator.FromHtml("#083438"); t.AutoSize = true; t.Location = new Point(40, 34);
        Label m = new Label(); m.Text = "The presentation data is missing." + Environment.NewLine + Environment.NewLine + "Keep “" + name + ".data” in the same folder as this app, then open it again." + Environment.NewLine + "If you moved only the .exe, copy both files together.";
        m.Font = new Font("Segoe UI", 11f); m.ForeColor = ColorTranslator.FromHtml("#33565A"); m.AutoSize = false; m.Size = new Size(540, 130); m.Location = new Point(42, 100);
        Button b = new Button(); b.Text = "Close"; b.Font = new Font("Segoe UI", 10f); b.FlatStyle = FlatStyle.Flat; b.FlatAppearance.BorderSize = 0; b.BackColor = ColorTranslator.FromHtml("#083438"); b.ForeColor = Color.White; b.Size = new Size(110, 40); b.Location = new Point(42, 230);
        b.Click += delegate { Close(); };
        Controls.Add(t); Controls.Add(m); Controls.Add(b); AcceptButton = b;
    }
}

class Viewer : Form
{
    const string Host = "https://content.local/";
    const long MaxMediaChunk = 8 * 1024 * 1024;
    readonly Package pkg; readonly bool windowed;
    Microsoft.Web.WebView2.WinForms.WebView2 web;
    Microsoft.Web.WebView2.Core.CoreWebView2Environment env;
    volatile bool unlocked;
    string userData;

    public Viewer(Package pkg, bool windowed)
    {
        this.pkg = pkg; this.windowed = windowed;
        unlocked = !pkg.PinRequired;
        Text = pkg.Name != null && pkg.Name.Length > 0 ? pkg.Name : "Presentation";
        BackColor = ColorTranslator.FromHtml(pkg.Bg ?? "#F9F9F7");
        KeyPreview = true;
        if (windowed) { StartPosition = FormStartPosition.CenterScreen; ClientSize = new Size(1280, 720); }
        else
        {
            FormBorderStyle = FormBorderStyle.None; StartPosition = FormStartPosition.Manual;
            Rectangle b = Screen.FromPoint(Cursor.Position).Bounds; Bounds = b; TopMost = true;
        }
        web = new Microsoft.Web.WebView2.WinForms.WebView2();
        web.Dock = DockStyle.Fill;
        web.DefaultBackgroundColor = BackColor;
        Controls.Add(web);
        Load += delegate { Init(); };
        FormClosed += delegate { Cleanup(); };
    }

    async void Init()
    {
        try
        {
            userData = Path.Combine(Entry.TempDir, "data");
            var opts = new Microsoft.Web.WebView2.Core.CoreWebView2EnvironmentOptions();
            string extra = Environment.GetEnvironmentVariable("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS");
            opts.AdditionalBrowserArguments = "--autoplay-policy=no-user-gesture-required --disable-features=msSmartScreenProtection" + (extra != null ? " " + extra : "");
            env = await Microsoft.Web.WebView2.Core.CoreWebView2Environment.CreateAsync(null, userData, opts);
            await web.EnsureCoreWebView2Async(env);
            var c = web.CoreWebView2;
            var s = c.Settings;
            s.AreDefaultContextMenusEnabled = false; s.IsStatusBarEnabled = false; s.IsZoomControlEnabled = false;
            s.AreBrowserAcceleratorKeysEnabled = false; s.IsPasswordAutosaveEnabled = false; s.IsGeneralAutofillEnabled = false; s.IsSwipeNavigationEnabled = false;
            s.AreDevToolsEnabled = windowed;
            c.AddWebResourceRequestedFilter(Host + "*", Microsoft.Web.WebView2.Core.CoreWebView2WebResourceContext.All);
            c.WebResourceRequested += OnRequest;
            c.WebMessageReceived += OnMessage;
            c.NewWindowRequested += delegate (object so, Microsoft.Web.WebView2.Core.CoreWebView2NewWindowRequestedEventArgs e)
            {
                e.Handled = true;
                if (e.Uri.StartsWith("http://") || e.Uri.StartsWith("https://")) { try { Process.Start(e.Uri); } catch (Exception) { } }
            };
            c.Navigate(Host + (unlocked ? "index.html" : "__gate.html"));
        }
        catch (Exception e)
        {
            MessageBox.Show("This presentation could not start.\n\n" + e.Message + "\n\nIt needs Windows 10/11 with the Microsoft Edge WebView2 Runtime (included with Windows 11).", "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            Close();
        }
    }

    void OnMessage(object s, Microsoft.Web.WebView2.Core.CoreWebView2WebMessageReceivedEventArgs e)
    {
        string m = e.TryGetWebMessageAsString();
        if (m == null || !m.StartsWith("pin:") || unlocked) return;
        string pin = m.Substring(4);
        Task.Run(delegate
        {
            bool ok = false;
            try { ok = pkg.Unlock(pin); } catch (Exception) { }
            if (!ok) Thread.Sleep(350);
            BeginInvoke((Action)delegate
            {
                if (ok) { unlocked = true; web.CoreWebView2.PostWebMessageAsString("ok"); web.CoreWebView2.Navigate(Host + "index.html"); }
                else web.CoreWebView2.PostWebMessageAsString("bad");
            });
        });
    }

    void OnRequest(object s, Microsoft.Web.WebView2.Core.CoreWebView2WebResourceRequestedEventArgs e)
    {
        try
        {
            Uri u = new Uri(e.Request.Uri);
            string path = Uri.UnescapeDataString(u.AbsolutePath.TrimStart('/'));
            if (path.Length == 0) path = "index.html";
            if (!unlocked)
            {
                if (path == "__gate.html") e.Response = env.CreateWebResourceResponse(new MemoryStream(pkg.Gate), 200, "OK", "Content-Type: text/html; charset=utf-8\r\nCache-Control: no-store");
                else e.Response = env.CreateWebResourceResponse(null, 403, "Forbidden", "");
                return;
            }
            Package.FileEnt fe;
            if (!pkg.Files.TryGetValue(path, out fe)) { e.Response = env.CreateWebResourceResponse(null, 404, "Not Found", "Content-Type: text/plain"); return; }
            bool media = fe.T.StartsWith("video/") || fe.T.StartsWith("audio/");
            long from = 0, to = fe.L - 1; bool partial = false;
            string range = null;
            if (e.Request.Headers.Contains("Range")) range = e.Request.Headers.GetHeader("Range");
            if (range != null && range.StartsWith("bytes="))
            {
                string[] pr = range.Substring(6).Split(',')[0].Split('-');
                long a, b;
                if (pr[0].Length == 0 && pr.Length > 1 && long.TryParse(pr[1], out b)) { from = Math.Max(0, fe.L - b); }
                else if (long.TryParse(pr[0], out a)) { from = a; if (pr.Length > 1 && long.TryParse(pr[1], out b)) to = Math.Min(b, fe.L - 1); }
                if (from >= fe.L) { e.Response = env.CreateWebResourceResponse(null, 416, "Range Not Satisfiable", "Content-Range: bytes */" + fe.L); return; }
                if (media && to - from + 1 > MaxMediaChunk) to = from + MaxMediaChunk - 1;       // keep memory flat: the player simply asks for the next range
                partial = true;
            }
            long n = to - from + 1;
            Stream body = pkg.Open(fe, from, n);
            string hdr = "Content-Type: " + fe.T + "\r\nContent-Length: " + n + "\r\nAccept-Ranges: bytes\r\nCache-Control: no-store";
            if (partial) hdr += "\r\nContent-Range: bytes " + from + "-" + to + "/" + fe.L;
            e.Response = env.CreateWebResourceResponse(body, partial ? 206 : 200, partial ? "Partial Content" : "OK", hdr);
        }
        catch (Exception)
        {
            e.Response = env.CreateWebResourceResponse(null, 500, "Error", "");
        }
    }

    void Cleanup()
    {
        try { if (web != null) web.Dispose(); } catch (Exception) { }
        for (int i = 0; i < 12; i++)
        {
            try { if (userData != null && Directory.Exists(userData)) Directory.Delete(userData, true); break; }
            catch (Exception) { Thread.Sleep(250); }
        }
    }
}
