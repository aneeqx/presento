"use strict";
// project.json: load / save / validate.  Format documented in docs/PROJECT-FORMAT.md
const fs = require("fs");
const path = require("path");

const FORMAT_VERSION = 1;
const PAGE_TYPES = ["gallery", "films", "panoramas", "flipbook", "social", "links"];
const RESERVED_IDS = ["home", "contact", "attract"];
const ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;

function loadProject(dir) {
  const file = path.join(dir, "project.json");
  if (!fs.existsSync(file)) throw new Error("No project.json in " + dir);
  const p = JSON.parse(fs.readFileSync(file, "utf8").replace(/^﻿/, ""));
  return migrate(p);
}

function saveProject(dir, project) {
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, "project.json.tmp");
  fs.writeFileSync(tmp, JSON.stringify(project, null, 2) + "\n", "utf8");
  fs.renameSync(tmp, path.join(dir, "project.json"));
}

/** Upgrade older project files in place (none yet: version 1 is the first). */
function migrate(p) {
  if (!p.version) p.version = 1;
  if (p.version > FORMAT_VERSION) throw new Error("project.json version " + p.version + " is newer than this build understands (" + FORMAT_VERSION + ")");
  return p;
}

function emptyProject(name) {
  return {
    format: "presentation-project", version: FORMAT_VERSION,
    id: String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "presentation",
    name,
    settings: {
      brand: { wordmark: null, logo: null, tagline: "", taglines: [] },
      intro: { enabled: false, video: null, handoff: 0 },
      background: { videos: [], start: 0, look: { gray: 1, dim: 0.42 } },
      startGate: true, idleReturnMinutes: 0,
      contact: { heading: "", subline: "", items: [] }
    },
    look: { bg: null, accent: null, font: null, logoSize: null, panelHeight: null, panelGap: null, labelShadow: null },
    sections: []
  };
}

/** Walk every leaf (a section without children, or a child). cb(sec, leaf, pathString) */
function eachLeaf(project, cb) {
  (project.sections || []).forEach(s => {
    if (s.children && s.children.length) s.children.forEach(c => cb(s, c, s.id + "/" + c.id));
    else cb(s, s, s.id);
  });
}

/** Static checks that need no filesystem. Returns {errors, warnings}. */
function validate(project) {
  const errors = [], warnings = [];
  const E = m => errors.push(m), W = m => warnings.push(m);
  if (project.format !== "presentation-project") E('format must be "presentation-project"');
  if (!project.name || !String(project.name).trim()) E("name is required");
  if (!Array.isArray(project.sections)) { E("sections must be an array"); return { errors, warnings }; }
  const seen = new Set();
  project.sections.forEach((s, i) => {
    const w = "sections[" + i + "]";
    if (!s.id || !ID_RE.test(s.id)) E(w + ": id '" + s.id + "' must be lowercase letters, digits, - or _");
    else if (RESERVED_IDS.includes(s.id)) E(w + ": id '" + s.id + "' is reserved");
    else if (seen.has(s.id)) E(w + ": duplicate id '" + s.id + "'");
    seen.add(s.id);
    if (!s.title) E(w + ": title is required");
    const hasKids = Array.isArray(s.children) && s.children.length > 0;
    if (hasKids && s.items) W(w + ": has both children and items; items are ignored");
    const leaves = hasKids ? s.children : [s];
    const subIds = new Set();
    leaves.forEach((l, j) => {
      const lw = hasKids ? w + ".children[" + j + "]" : w;
      if (hasKids) {
        if (!l.id || !ID_RE.test(l.id)) E(lw + ": id '" + l.id + "' invalid");
        else if (subIds.has(l.id)) E(lw + ": duplicate sub-section id '" + l.id + "'");
        subIds.add(l.id);
        if (!l.title) E(lw + ": title is required");
        if (l.children && l.children.length) E(lw + ": sub-sections cannot have children (two levels only)");
      }
      if (!PAGE_TYPES.includes(l.type)) E(lw + ": type must be one of " + PAGE_TYPES.join(", ") + " (got '" + l.type + "')");
      if (l.type === "social") { if (!l.social) E(lw + ": social page needs a 'social' object"); }
      else if (!Array.isArray(l.items)) E(lw + ": items must be an array");
      (l.items || []).forEach((it, k) => {
        const iw = lw + ".items[" + k + "]";
        if (l.type === "flipbook") { if (!Array.isArray(it.pages) || !it.pages.length) E(iw + ": flipbook item needs pages[]"); }
        else if (!it.file) E(iw + ": file is required");
        if (l.type === "links" && !it.url) E(iw + ": url is required for links");
        if (it.start != null && !(+it.start >= 0)) E(iw + ": start must be seconds >= 0");
        if (it.end != null && !(+it.end > 0)) E(iw + ": end must be seconds > 0");
        if (it.start != null && it.end != null && +it.end <= +it.start) E(iw + ": end must be greater than start");
        if ((it.start != null || it.end != null) && l.type !== "films") W(iw + ": start/end only apply to films");
        if (it.crop) {
          const c = it.crop;
          if (![c.x, c.y, c.w, c.h].every(v => typeof v === "number" && v >= 0 && v <= 1) || c.w <= 0 || c.h <= 0 || c.x + c.w > 1.0001 || c.y + c.h > 1.0001) E(iw + ": crop must be {x,y,w,h} as fractions 0..1 inside the image");
          if (!it.cropFile) E(iw + ": crop is set but cropFile (the lossless rendered crop) is missing");
        }
      });
    });
    if (s.defaultSub && hasKids && !s.children.some(c => c.id === s.defaultSub)) W(w + ": defaultSub '" + s.defaultSub + "' does not exist");
  });
  return { errors, warnings };
}

module.exports = { FORMAT_VERSION, PAGE_TYPES, RESERVED_IDS, loadProject, saveProject, emptyProject, validate, eachLeaf, migrate };
