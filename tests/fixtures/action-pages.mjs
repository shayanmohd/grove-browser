// Pages for dragging, controls drawn with no size, panels that scroll inside a
// page, a page locked behind a modal, and controls a page draws again, as met
// in Play Console. MUI's modal locks the page behind it with overflow:hidden
// on the body. The ACX
// reorder list (angular_components/lib/reorder_list) drags with HTML5 events
// and commits the new order on dragend. Angular CDK drag-drop follows mouse
// events past a 5 pixel threshold and ignores a mousedown with no buttons
// pressed, which screen readers send. Angular creates a component again when a
// template condition or list changes, and ACX gives each new instance a new
// generated id.
export const actionPages = {
  "/actions/drag": `<!doctype html><meta charset="utf-8"><title>Drag and drop</title>
<style>
body{font:14px sans-serif;margin:16px}
reorder-list{display:flex;gap:8px}
reorder-list>[draggable]{-webkit-user-drag:element;user-select:none}
.screenshot{width:96px;height:80px;border:1px solid #666;display:flex;align-items:center;justify-content:center}
.reorder-list-dragging-active{cursor:move;opacity:.4}
#featured{margin-top:16px;width:320px;height:64px;border:2px dashed #555;display:flex;align-items:center;justify-content:center}
.cdk-drop-list{width:240px;margin-top:16px;border:1px solid #ccc}
.cdk-drag{padding:12px;border-bottom:1px solid #ccc;background:#fff;cursor:move}
.cdk-drag-placeholder{opacity:.3}
.cdk-drag-preview{position:fixed;pointer-events:none;box-shadow:0 4px 8px #0004;margin:0}
</style>
<h1>Phone screenshots</h1>
<reorder-list class="reorder-list" id="screenshots"></reorder-list>
<div id="featured">Drop a screenshot here to feature it</div>
<h2>Release tracks</h2>
<div cdkdroplist class="cdk-drop-list" id="tracks"></div>
<button id="after-drag" type="button">Confirm order</button>
<p id="drag-result" role="status">No changes</p>
<script>
const result = (text) => { document.querySelector('#drag-result').textContent = text; };
// ACX reorder-list: each item is draggable, sets its id as "Text" data, and the
// list reorders on dragend from the last item the pointer dragged over.
let order = ['Screenshot 1', 'Screenshot 2', 'Screenshot 3', 'Screenshot 4'];
let source = -1, current = -1;
const render = () => {
  const list = document.querySelector('#screenshots');
  list.innerHTML = order.map((name, i) => '<div class="screenshot" reorderitem role="listitem" tabindex="0" draggable="true" id="shot-' + i + '">' + name + '</div>').join('');
  list.querySelectorAll('.screenshot').forEach((item, i) => {
    item.addEventListener('dragstart', (event) => { event.dataTransfer.setData('Text', item.id); event.dataTransfer.effectAllowed = 'copyMove'; source = current = i; item.classList.add('reorder-list-dragging-active'); });
    item.addEventListener('dragover', () => { if (i !== source) current = i; });
    item.addEventListener('dragend', (event) => {
      event.stopPropagation();
      item.classList.remove('reorder-list-dragging-active');
      if (source !== current) { const [moved] = order.splice(source, 1); order.splice(current, 0, moved); render(); }
      result('Order: ' + order.join(', '));
    });
  });
};
render();
const featured = document.querySelector('#featured');
featured.addEventListener('dragover', (event) => { event.preventDefault(); current = source; });
featured.addEventListener('drop', (event) => { event.preventDefault(); featured.textContent = 'Featured ' + document.getElementById(event.dataTransfer.getData('Text')).textContent; });
// Angular CDK drag-drop: a preview follows the pointer, the item stays as a
// placeholder that moves to the sibling under the pointer, and the list emits
// the move on mouseup.
let tracks = ['Internal testing', 'Closed testing', 'Open testing', 'Production'];
const renderTracks = () => { document.querySelector('#tracks').innerHTML = tracks.map((t) => '<div cdkdrag class="cdk-drag" style="user-select:none;-webkit-user-drag:none;touch-action:none">' + t + '</div>').join(''); };
renderTracks();
document.querySelector('#tracks').addEventListener('mousedown', (down) => {
  const item = down.target.closest('.cdk-drag');
  if (!item || down.button !== 0 || down.buttons === 0) return;
  const list = document.querySelector('#tracks');
  const from = [...list.children].indexOf(item);
  let preview = null;
  const move = (event) => {
    if (!preview) {
      if (Math.abs(event.clientX - down.clientX) + Math.abs(event.clientY - down.clientY) < 5) return;
      const box = item.getBoundingClientRect();
      preview = item.cloneNode(true); preview.className = 'cdk-drag cdk-drag-preview';
      preview.style.width = box.width + 'px'; preview.style.left = box.left + 'px'; preview.style.top = box.top + 'px';
      document.body.append(preview); item.classList.add('cdk-drag-placeholder');
    }
    preview.style.transform = 'translate(' + (event.clientX - down.clientX) + 'px,' + (event.clientY - down.clientY) + 'px)';
    const over = [...list.children].find((other) => { const r = other.getBoundingClientRect(); return other !== item && event.clientY >= r.top && event.clientY < r.bottom; });
    if (over) list.insertBefore(item, [...list.children].indexOf(over) > [...list.children].indexOf(item) ? over.nextSibling : over);
  };
  const up = () => {
    document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up);
    if (!preview) return;
    preview.remove(); item.classList.remove('cdk-drag-placeholder');
    const to = [...list.children].indexOf(item);
    const [moved] = tracks.splice(from, 1); tracks.splice(to, 0, moved); renderTracks();
    result('Tracks: ' + tracks.join(', '));
  };
  document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
});
document.querySelector('#after-drag').addEventListener('click', () => result('Confirmed ' + order.join(', ')));
</script>`,
  "/actions/zero-size": `<!doctype html><meta charset="utf-8"><title>Zero-size controls</title>
<style>
body{font:14px sans-serif;margin:16px}
.row{display:flex;gap:8px;align-items:center;padding:8px;border-bottom:1px solid #ddd;cursor:pointer}
material-radio{display:inline-flex;margin:0}
material-radio .icon-container{display:none}
.native-zero{appearance:none;width:0;height:0;margin:0;padding:0;border:0}
.covered{position:relative}
.cover{position:absolute;inset:0;background:#fffd;display:flex;align-items:center;justify-content:center}
#offscreen{position:absolute;left:-9999px;top:0}
</style>
<h1>Choose a track</h1>
<div role="list" id="tracks">
  <div class="row" role="listitem"><material-radio role="radio" aria-checked="false" tabindex="0" aria-disabled="false" id="radio-internal"><div class="icon-container"></div><div class="content"></div></material-radio><span>Internal testing</span></div>
  <div class="row" role="listitem"><material-radio role="radio" aria-checked="false" tabindex="-1" aria-disabled="false" id="radio-closed"><div class="icon-container"></div><div class="content"></div></material-radio><span>Closed testing</span></div>
  <label class="row"><input type="radio" name="track" value="open" class="native-zero" id="radio-open"><span>Open testing</span></label>
  <div class="covered"><div class="row" role="listitem"><material-radio role="radio" aria-checked="false" tabindex="-1" aria-disabled="false" aria-label="Production" id="radio-production"><div class="icon-container"></div><div class="content"></div></material-radio><span>Production</span></div><div class="cover">Loading tracks</div></div>
</div>
<div id="offscreen"><material-radio role="radio" aria-checked="false" tabindex="-1" aria-label="Archived track" id="radio-archived"><div class="icon-container"></div><div class="content"></div></material-radio></div>
<p id="zero-result" role="status">No track chosen</p>
<script>
for (const radio of document.querySelectorAll('material-radio')) radio.addEventListener('click', () => {
  for (const other of document.querySelectorAll('material-radio')) other.setAttribute('aria-checked', String(other === radio));
  document.querySelector('#zero-result').textContent = 'Chose ' + (radio.getAttribute('aria-label') || radio.parentElement.textContent.trim());
});
document.querySelector('#radio-open').addEventListener('change', () => { document.querySelector('#zero-result').textContent = 'Chose Open testing'; });
</script>`,
  "/actions/inner-scroll": `<!doctype html><meta charset="utf-8"><title>Inner scrolling</title>
<style>
html,body{height:100%;margin:0;overflow:hidden;font:14px sans-serif}
.material-header{height:64px;display:flex;align-items:center;padding:0 16px;background:#3f51b5;color:#fff}
material-drawer{position:absolute;top:64px;bottom:0;left:0;width:200px;overflow:hidden;display:flex;flex-direction:column}
material-drawer material-list{overflow:auto;display:block}
material-content{position:absolute;top:64px;bottom:0;left:200px;right:0;overflow-y:auto;display:block;padding:0 16px}
.table-scroll{overflow-x:auto;width:400px;border:1px solid #ccc}
.table-scroll table{width:1600px}
.popup{max-height:120px;overflow:auto;border:1px solid #999;width:200px}
</style>
<header class="material-header">Kamapathy console</header>
<material-drawer permanent><material-list id="nav"></material-list></material-drawer>
<material-content id="content">
  <h1>Release notes</h1>
  <div class="table-scroll" id="countries"><table><tr id="country-row"></tr></table></div>
  <div class="popup" id="languages" role="listbox" aria-label="Languages"></div>
  <div id="releases"></div>
  <p id="scroll-result" role="status">Showing recent releases</p>
</material-content>
<script>
document.querySelector('#nav').innerHTML = Array.from({ length: 60 }, (_, i) => '<a href="#page-' + (i + 1) + '" style="display:block;padding:6px 16px">Page ' + (i + 1) + '</a>').join('');
document.querySelector('#country-row').innerHTML = Array.from({ length: 20 }, (_, i) => '<td>Country ' + (i + 1) + '</td>').join('');
document.querySelector('#languages').innerHTML = Array.from({ length: 20 }, (_, i) => '<div role="option" aria-selected="false" tabindex="-1">Language ' + (i + 1) + '</div>').join('');
let shown = 40;
const releases = document.querySelector('#releases');
releases.innerHTML = Array.from({ length: 20 }, (_, i) => '<p>Release ' + (shown - i) + ' fixed a few bugs.</p>').join('');
// Older releases load only when the content panel is scrolled near its end.
const content = document.querySelector('#content');
content.addEventListener('scroll', () => {
  if (shown <= 20 || content.scrollTop + content.clientHeight < content.scrollHeight - 100) return;
  shown = 20;
  releases.insertAdjacentHTML('beforeend', Array.from({ length: 20 }, (_, i) => '<p>Release ' + (shown - i) + ' fixed a few bugs.</p>').join(''));
  document.querySelector('#scroll-result').textContent = 'Loaded older releases';
});
</script>`,
  "/actions/rerender": `<!doctype html><meta charset="utf-8"><title>Redrawn controls</title>
<style>
body{font:14px sans-serif;margin:16px}
material-button{display:inline-flex;cursor:pointer;padding:6px 12px;border:1px solid #1a73e8;margin:4px}
material-button[aria-disabled=true]{opacity:.5;cursor:default}
.bottom-bar{position:sticky;bottom:0;background:#fff;border-top:1px solid #ccc;padding:8px}
</style>
<h1>App details</h1>
<label for="title">App title</label><input id="title" value="ClickTrack">
<ul id="list"></ul>
<material-button role="button" tabindex="0" aria-disabled="false" id="import-rows"><div class="content">Import tester lists</div></material-button>
<material-button role="button" tabindex="0" aria-disabled="false" id="next-step"><div class="content">Next step</div></material-button>
<div id="settings"><section><h2>Notifications</h2><div role="button" tabindex="0" class="apply">Apply</div></section></div>
<material-button role="button" tabindex="0" aria-disabled="false" id="all-settings"><div class="content">Show all settings</div></material-button>
<div class="bottom-bar" id="bar"></div>
<p id="rerender-result" role="status">Nothing saved</p>
<script>
// AngularDart gives each new component instance a new generated id, so an id
// seen before the page draws a component again never matches afterwards.
let generation = 0;
const uid = () => 'A1B2C3D4-0000-4000-8000-' + String(++generation).padStart(12, '0') + '--0';
const renderBar = (dirty) => {
  document.querySelector('#bar').innerHTML =
    '<material-button role="button" tabindex="0" aria-disabled="false" id="' + uid() + '"><div class="content">Discard changes</div></material-button>' +
    '<material-button role="button" tabindex="' + (dirty ? 0 : -1) + '" aria-disabled="' + !dirty + '" id="' + uid() + '" class="save"><div class="content">Save</div></material-button>';
};
let rows = ['Internal testers', 'Closed testers'];
const renderList = () => {
  document.querySelector('#list').innerHTML = rows.map((row) => '<li><span>' + row + '</span><material-button role="button" tabindex="0" aria-disabled="false"><div class="content">Remove</div></material-button></li>').join('');
};
renderBar(false); renderList();
document.querySelector('#title').addEventListener('input', () => renderBar(true));
document.querySelector('#bar').addEventListener('click', (event) => {
  const button = event.target.closest('material-button'); if (!button || button.getAttribute('aria-disabled') === 'true') return;
  document.querySelector('#rerender-result').textContent = button.classList.contains('save') ? 'Saved ' + document.querySelector('#title').value : 'Discarded';
});
// Lists imported from another app go first, and one repeats an existing name.
document.querySelector('#import-rows').addEventListener('click', () => { rows = ['Open testers', 'Internal testers', ...rows]; renderList(); });
document.querySelector('#next-step').addEventListener('click', () => { history.pushState({}, '', '?step=2'); renderBar(true); document.querySelector('#rerender-result').textContent = 'Step 2'; });
document.querySelector('#list').addEventListener('click', (event) => {
  const button = event.target.closest('material-button'); if (!button) return;
  const index = [...document.querySelector('#list').children].indexOf(button.parentElement);
  const [name] = rows.splice(index, 1); renderList();
  document.querySelector('#rerender-result').textContent = 'Removed ' + name + ', ' + rows.length + ' left';
});
// Showing every setting draws the Notifications section again below a new
// one, then the other settings, then the default Notifications section.
const notifications = '<section><h2>Notifications</h2><div role="button" tabindex="0" class="apply">Apply</div></section>';
document.querySelector('#all-settings').addEventListener('click', () => {
  document.querySelector('#settings').innerHTML = '<section><h2>Account</h2></section>' + notifications + '<div></div>'.repeat(2100) + notifications;
});
document.querySelector('#settings').addEventListener('click', (event) => {
  if (event.target.closest('.apply')) document.querySelector('#rerender-result').textContent = 'Applied';
});
</script>`,
  "/actions/scroll-lock": `<!doctype html><meta charset="utf-8"><title>Scroll lock</title>
<style>
body{margin:0;font:14px sans-serif}
.app-header{height:60px;display:flex;align-items:center;padding:0 16px;background:#1976d2;color:#fff}
.page{padding:16px}
.MuiModal-root{position:fixed;inset:0;z-index:1300}
.MuiBackdrop-root{position:fixed;inset:0;background:rgba(0,0,0,.5)}
.MuiDialog-container{height:100%;display:flex;align-items:center;justify-content:center;outline:0}
.MuiDialog-paper{position:relative;background:#fff;max-height:calc(100% - 64px);width:480px;display:flex;flex-direction:column;overflow-y:auto}
.MuiDialogContent-root{flex:1 1 auto;overflow-y:auto;max-height:300px;padding:0 24px}
</style>
<header class="app-header">Store listing</header>
<div class="page"><h1>Graphics</h1><div style="height:1200px">Upload phone screenshots.</div><footer>End of page</footer></div>
<div role="presentation" class="MuiDialog-root MuiModal-root"><div class="MuiBackdrop-root" aria-hidden="true"></div><div tabindex="0" data-testid="sentinelStart"></div>
  <div class="MuiDialog-container MuiDialog-scrollPaper" role="presentation" tabindex="-1"><div class="MuiPaper-root MuiDialog-paper" role="dialog" aria-labelledby="dialog-title">
    <h2 class="MuiDialogTitle-root" id="dialog-title">Terms of service</h2>
    <div class="MuiDialogContent-root MuiDialogContent-dividers" id="terms"></div>
    <div class="MuiDialogActions-root"><button type="button">Disagree</button><button type="button">Agree</button></div>
  </div></div>
<div tabindex="0" data-testid="sentinelEnd"></div></div>
<script>
document.querySelector('#terms').innerHTML = Array.from({ length: 30 }, (_, i) => '<p>Term ' + (i + 1) + ' applies to every release.</p>').join('');
document.body.style.overflow = 'hidden';
</script>`,
};
