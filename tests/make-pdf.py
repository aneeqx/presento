"""Generates a multi-page test PDF with bookmarks, a web link and an internal link. uv run --with pymupdf python tests/make-pdf.py <out.pdf>"""
import sys, fitz
doc = fitz.open()
titles = ["Cover", "Who we are", "What we do", "Selected projects", "Process", "Team", "Contact", "Back cover"]
cols = [(.03, .2, .22), (.96, .94, .9), (.9, .95, .93), (.95, .9, .85), (.88, .92, .96), (.96, .88, .9), (.92, .96, .88), (.03, .2, .22)]
for i, t in enumerate(titles):
    p = doc.new_page(width=595, height=842)
    p.draw_rect(p.rect, color=None, fill=cols[i])
    dark = i in (0, 7)
    p.insert_text((50, 120), t, fontsize=44, color=(1, 1, 1) if dark else (.03, .2, .22))
    p.insert_text((50, 170), "Page %d of %d - test brochure" % (i + 1, len(titles)), fontsize=14, color=(1, 1, 1) if dark else (.2, .3, .3))
    p.draw_circle((300, 450), 120, color=None, fill=(.18, .93, .59) if i % 2 == 0 else (.03, .2, .22))
    if i == 1:
        r = fitz.Rect(50, 700, 300, 740); p.insert_text((55, 725), "Visit example.com", fontsize=16, color=(0, 0, .8)); p.insert_link({"kind": fitz.LINK_URI, "from": r, "uri": "https://example.com"})
    if i == 2:
        p.insert_text((55, 725), "Jump to the contact page", fontsize=16, color=(0, 0, .8))
doc[2].insert_link({"kind": fitz.LINK_GOTO, "from": fitz.Rect(50, 700, 330, 740), "page": 6, "to": fitz.Point(0, 0)})
doc.set_toc([[1, "Cover", 1], [1, "Who we are", 2], [1, "What we do", 3], [2, "Selected projects", 4], [1, "Contact", 7]])
doc.save(sys.argv[1]); print("saved", sys.argv[1], len(doc), "pages")
