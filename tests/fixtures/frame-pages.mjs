// Pages whose controls sit inside open shadow roots and same-origin frames,
// as component libraries and embedded forms draw them, plus a frame from
// another origin that a snapshot can only announce. That frame is served by
// the same server through the other loopback name. The frames carry a border
// and padding, and the deep button sits at the frame's top left corner, so a
// click that ignores the frame offsets lands outside it.
export const framePages = {
  "/frames/shadow": `<!doctype html><meta charset="utf-8"><title>Shadow controls</title>
<style>body{font:14px sans-serif;margin:16px}</style>
<h1>Shadow settings</h1>
<x-card id="card"><span slot="title">Notifications</span><button slot="action" type="button" id="light">Slotted action</button><span>Not shown</span></x-card>
<p id="shadow-result" role="status">Shadow untouched</p>
<script>
class XCard extends HTMLElement {
  connectedCallback() {
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = '<div style="border:1px solid #666;padding:12px"><h2><slot name="title"></slot></h2><p>Rendered in the shadow root</p><label for="alerts">Email alerts</label><input id="alerts" type="checkbox"><button type="button" id="save">Save preferences</button><slot name="action"></slot></div>';
    root.getElementById("save").onclick = () => { document.getElementById("shadow-result").textContent = "Saved from shadow"; };
  }
}
customElements.define("x-card", XCard);
document.getElementById("light").onclick = () => { document.getElementById("shadow-result").textContent = "Slotted clicked"; };
</script>`,
  "/frames/outer": `<!doctype html><meta charset="utf-8"><title>Embedded forms</title>
<style>body{font:14px sans-serif;margin:16px}iframe{display:block;border:4px solid #666;padding:6px;width:420px;height:300px}#other{height:80px}</style>
<h1>Outer page</h1>
<p>Text above the frame</p>
<iframe id="inner" title="Inner form" src="/frames/inner"></iframe>
<p id="outer-result" role="status">Outer untouched</p>
<iframe id="other" title="Card details"></iframe>
<script>
const otherHost = location.hostname === "localhost" ? "127.0.0.1" : "localhost";
document.getElementById("other").src = location.origin.replace(location.hostname, otherHost) + "/frames/other";
</script>`,
  "/frames/inner": `<!doctype html><meta charset="utf-8"><title>Inner form</title>
<style>body{font:14px sans-serif;margin:8px}iframe{display:block;border:2px solid #999;padding:4px;width:300px;height:60px}</style>
<p>Text inside the frame</p>
<label for="note">Frame note</label><input id="note" type="text">
<button type="button" id="apply">Apply in frame</button>
<input id="file" type="file" aria-label="Frame file">
<p id="inner-result" role="status">Inner untouched</p>
<iframe id="nested" title="Nested frame" src="/frames/nested"></iframe>
<script>
const result = document.getElementById("inner-result");
document.getElementById("apply").onclick = () => { result.textContent = "Applied " + document.getElementById("note").value; };
document.getElementById("note").onkeydown = (event) => { if (event.key === "Enter") result.textContent = "Entered " + event.target.value; };
document.getElementById("file").onchange = (event) => { result.textContent = "Files " + event.target.files.length; };
</script>`,
  "/frames/nested": `<!doctype html><meta charset="utf-8"><title>Nested frame</title>
<style>body{font:14px sans-serif;margin:0}#deep{position:absolute;left:0;top:0;width:90px;height:20px;padding:0}</style>
<button type="button" id="deep" onclick="this.textContent='Deep clicked'">Deep button</button>
<p style="margin:28px 0 0">Text two frames deep</p>`,
  "/frames/other": `<!doctype html><meta charset="utf-8"><title>Card details</title><p>Card number</p><input aria-label="Card number">`,
};
