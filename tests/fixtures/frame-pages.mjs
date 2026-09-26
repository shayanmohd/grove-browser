// Pages whose controls sit inside open shadow roots and same-origin frames,
// as component libraries and embedded forms draw them, plus a frame from
// another origin that a snapshot can only announce. That frame is served by
// the same server through the other loopback name. The frames carry a border
// and padding, and the deep button sits at the frame's top left corner, so a
// click that ignores the frame offsets lands outside it. The later pages host
// a frame inside a shadow root, scroll and scale frames, give a frame control
// the same selector as one outside it, and hide frames with CSS visibility.
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
  "/frames/shadow-frame": `<!doctype html><meta charset="utf-8"><title>Shadow frame</title>
<style>body{font:14px sans-serif;margin:16px}</style>
<h1>Widget host</h1>
<x-widget id="widget"></x-widget>
<script>
class XWidget extends HTMLElement {
  connectedCallback() {
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = '<iframe id="embedded" title="Embedded form" src="/frames/embedded" style="display:block;width:360px;height:160px;border:3px solid #666;padding:5px"></iframe>';
  }
}
customElements.define("x-widget", XWidget);
</script>`,
  "/frames/embedded": `<!doctype html><meta charset="utf-8"><title>Embedded form</title>
<style>body{font:14px sans-serif;margin:8px}</style>
<button type="button" id="count" onclick="this.textContent='Counted '+(++window.clicks)">Count clicks</button>
<label for="word">Embedded word</label><input id="word" type="text">
<p id="embedded-result" role="status">Embedded untouched</p>
<script>
window.clicks = 0;
document.getElementById("word").onkeydown = (event) => { if (event.key === "Enter") document.getElementById("embedded-result").textContent = "Entered " + event.target.value; };
</script>`,
  "/frames/scroller": `<!doctype html><meta charset="utf-8"><title>Frame scroller</title>
<style>body{margin:0}iframe{display:block;width:400px;height:200px;border:0}</style>
<iframe id="tall" title="Tall list" src="/frames/tall"></iframe>`,
  "/frames/tall": `<!doctype html><meta charset="utf-8"><title>Tall list</title>
<style>body{margin:0}</style>
<button type="button" id="first">First item</button>
<div style="height:3000px"></div>
<button type="button" id="last">Last item</button>`,
  "/frames/scaled": `<!doctype html><meta charset="utf-8"><title>Scaled frames</title>
<style>body{margin:0}iframe{display:block;width:400px;height:200px;border:4px solid #666;padding:6px;margin:0 0 10px}#scaled{transform:scale(0.5);transform-origin:0 0}#zoomed{zoom:0.5}</style>
<iframe id="scaled" title="Scaled grid" src="/frames/grid"></iframe>
<iframe id="zoomed" title="Zoomed grid" src="/frames/grid"></iframe>`,
  "/frames/grid": `<!doctype html><meta charset="utf-8"><title>Grid</title>
<style>body{margin:0}button{position:absolute;width:100px;height:40px;margin:0;padding:0}</style>
<button type="button" id="target" style="left:100px;top:40px">Target</button>
<button type="button" id="decoy" style="left:260px;top:110px">Decoy</button>
<p id="grid-hit" role="status" style="position:absolute;left:0;top:160px;margin:0">Grid untouched</p>
<script>
for (const button of document.querySelectorAll("button"))
  button.onclick = () => { document.getElementById("grid-hit").textContent = frameElement.title + " hit " + button.textContent; };
</script>`,
  "/frames/twins": `<!doctype html><meta charset="utf-8"><title>Twin selectors</title>
<style>body{font:14px sans-serif;margin:16px}iframe{display:block;width:300px;height:80px;border:0}</style>
<button type="button" id="save" onclick="document.getElementById('twin-result').textContent='Outer saved'">Save</button>
<iframe id="twin" title="Twin form" src="/frames/twin"></iframe>
<p id="twin-result" role="status">Twins untouched</p>`,
  "/frames/twin": `<!doctype html><meta charset="utf-8"><title>Twin form</title>
<style>body{font:14px sans-serif;margin:8px}</style>
<p>Twin text</p>
<button type="button" class="twin" id="save" onclick="this.textContent='Frame saved'">Save</button>
<button type="button" class="twin" id="other" onclick="this.textContent='Other saved'">Other</button>`,
  "/frames/hidden": `<!doctype html><meta charset="utf-8"><title>Hidden frames</title>
<style>body{font:14px sans-serif;margin:16px}iframe{display:block;width:300px;height:100px;border:0}</style>
<p>Shown around the frames</p>
<iframe id="hidden" title="Hidden form" src="/frames/twin" style="visibility:hidden"></iframe>
<iframe id="collapsed" title="Collapsed form" src="/frames/twin" style="visibility:collapse"></iframe>
<x-veiled id="veiled" style="visibility:hidden"></x-veiled>
<script>
class XVeiled extends HTMLElement {
  connectedCallback() {
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = '<p>Veiled text</p><button type="button">Veiled button</button>';
  }
}
customElements.define("x-veiled", XVeiled);
</script>`,
};
