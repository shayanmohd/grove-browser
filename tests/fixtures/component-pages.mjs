// Pages that reproduce the DOM Google's Angular components (ACX) render in
// Play Console, from github.com/angulardart/angular_components and its live
// gallery: dropdown selects whose options are custom elements, Material radio
// questionnaires, inputs whose visible label is aria-hidden, a long page whose
// sticky action bar and dialog come after a long sidebar, and a tree whose
// rows are buttons around tree items with their own expand buttons. The MUI
// page hides the rest of the page with aria-hidden while its select menu is
// open, and the MUI documentation layout pins a tall sidebar and table of
// contents beside the page. Angular Material 22 opens a select's options in a
// popover inside the select element.
export const componentPages = {
  "/components/acx-dropdown": `<!doctype html><meta charset="utf-8"><title>ACX dropdown</title>
<style>
.material-icons{font-family:'Material Icons';font-style:normal;font-size:24px;line-height:1;display:inline-block;width:24px;height:24px;overflow:hidden;white-space:nowrap;vertical-align:middle}
material-dropdown-select,dropdown-button{display:inline-block}
.button{display:inline-flex;align-items:center;gap:4px;padding:4px 8px;border:1px solid #999;cursor:pointer}
.acx-overlay-container{position:absolute;pointer-events:none;top:0;left:0;width:100%;height:100%;z-index:10}
.acx-overlay-container>.pane{display:flex;position:absolute;z-index:11;pointer-events:none}
.acx-overlay-container>.pane>*{pointer-events:auto;display:flex}
.popup{background:#fff;box-shadow:0 2px 6px #0004;max-height:200px;overflow:auto}
material-list{display:block;padding:8px 0}
material-select-dropdown-item{display:flex;padding:6px 16px;cursor:pointer}
material-select-dropdown-item.selected{background:#e8f0fe}
</style>
<h1>Advanced settings</h1>
<p>Publishing overview</p>
<material-dropdown-select id="publishing">
  <dropdown-button popuptype="listbox">
    <div buttondecorator class="button border" id="3F2A1C44-9B0E-4C1D-8E7F-1A2B3C4D5E6F--0" role="listbox" aria-haspopup="listbox" aria-expanded="false" tabindex="0" aria-disabled="false">
      <glyph class="leading"><i aria-hidden="true" class="glyph-i material-icons">sync_disabled</i></glyph><span class="button-text">Managed publishing off</span><glyph class="icon"><i aria-hidden="true" class="glyph-i material-icons">arrow_drop_down</i></glyph>
    </div>
  </dropdown-button>
  <material-popup enforcespaceconstraints></material-popup>
</material-dropdown-select>
<material-dropdown-select id="countries">
  <dropdown-button popuptype="listbox">
    <div buttondecorator class="button border" id="3F2A1C44-9B0E-4C1D-8E7F-1A2B3C4D5E6F--1" role="button" aria-haspopup="listbox" aria-expanded="false" tabindex="0" aria-disabled="false">
      <span class="button-text">2 countries</span><glyph class="icon"><i aria-hidden="true" class="glyph-i material-icons">arrow_drop_down</i></glyph>
    </div>
  </dropdown-button>
  <material-popup enforcespaceconstraints></material-popup>
</material-dropdown-select>
<p id="dropdown-result" role="status">Nothing chosen</p>
<div class="acx-overlay-container" id="default-acx-overlay-container" name="default">
  <div pane-id="default-1" class="pane" style="display:none;left:8px;top:120px">
    <div class="popup-wrapper mixin shadow full-width" role="dialog" elevation="2" id="popup-publishing">
      <div class="popup">
        <div class="focusable-placeholder" tabindex="0"></div>
        <div class="material-popup-content content"><header></header><div class="main">
          <material-list class="options-list" role="listbox" tabindex="0" id="list-publishing">
            <div class="options-wrapper"><div group>
              <material-select-dropdown-item class="item selected" role="option" aria-disabled="false" id="opt-p0" aria-selected="true"><div class="selected-accent mixin"></div><span class="label">Managed publishing off</span></material-select-dropdown-item>
              <material-select-dropdown-item class="item" role="option" aria-disabled="false" id="opt-p1" aria-selected="false"><span class="label">Managed publishing on</span></material-select-dropdown-item>
            </div></div>
          </material-list>
        </div><footer></footer></div>
        <div class="focusable-placeholder" tabindex="0"></div>
      </div>
    </div>
  </div>
  <div pane-id="default-2" class="pane" style="display:none;left:8px;top:160px">
    <div class="popup-wrapper mixin shadow full-width" role="dialog" elevation="2" id="popup-countries">
      <div class="popup">
        <div class="focusable-placeholder" tabindex="0"></div>
        <div class="material-popup-content content"><header></header><div class="main">
          <material-list class="options-list" role="listbox" tabindex="0" id="list-countries" aria-multiselectable="true">
            <div class="options-wrapper"><div group><span label>Europe</span>
              <material-select-dropdown-item class="item multiselect selected" role="option" aria-disabled="false" id="opt-c0" aria-selected="true" aria-checked="true"><material-checkbox tabindex="-1" role="checkbox" aria-checked="true" aria-labelledby="cb-c0" aria-disabled="false" class="themeable"><div class="icon-container"><material-icon aria-hidden="true" class="icon filled"><i aria-hidden="true" class="material-icon-i material-icons">check_box</i></material-icon></div><div class="content" id="cb-c0"></div></material-checkbox><span class="label">France</span></material-select-dropdown-item>
              <material-select-dropdown-item class="item multiselect selected" role="option" aria-disabled="false" id="opt-c1" aria-selected="true" aria-checked="true"><material-checkbox tabindex="-1" role="checkbox" aria-checked="true" aria-labelledby="cb-c1" aria-disabled="false" class="themeable"><div class="icon-container"><material-icon aria-hidden="true" class="icon filled"><i aria-hidden="true" class="material-icon-i material-icons">check_box</i></material-icon></div><div class="content" id="cb-c1"></div></material-checkbox><span class="label">Germany</span></material-select-dropdown-item>
              <material-select-dropdown-item class="item multiselect" role="option" aria-disabled="true" id="opt-c2" aria-selected="false" aria-checked="false"><material-checkbox tabindex="-1" role="checkbox" aria-checked="false" aria-labelledby="cb-c2" aria-disabled="true" class="themeable"><div class="icon-container"><material-icon aria-hidden="true" class="icon"><i aria-hidden="true" class="material-icon-i material-icons">check_box_outline_blank</i></material-icon></div><div class="content" id="cb-c2"></div></material-checkbox><span class="label">Italy (unavailable)</span></material-select-dropdown-item>
            </div></div>
          </material-list>
        </div><footer></footer></div>
        <div class="focusable-placeholder" tabindex="0"></div>
      </div>
    </div>
  </div>
</div>
<script>
const wire = (select, paneId, listId) => {
  const button = document.querySelector('#' + select + ' .button');
  const pane = document.querySelector('[pane-id="' + paneId + '"]');
  const close = () => { pane.style.display = 'none'; pane.classList.remove('visible'); button.setAttribute('aria-expanded', 'false'); button.removeAttribute('aria-owns'); };
  button.addEventListener('click', () => {
    const open = pane.style.display === 'none';
    if (!open) return close();
    pane.style.display = 'flex'; pane.classList.add('visible');
    button.setAttribute('aria-expanded', 'true'); button.setAttribute('aria-owns', listId);
  });
  for (const item of pane.querySelectorAll('[role=option]')) item.addEventListener('click', () => {
    if (item.getAttribute('aria-disabled') === 'true') return;
    const multi = pane.querySelector('[aria-multiselectable=true]');
    if (!multi) for (const other of pane.querySelectorAll('[role=option]')) { other.setAttribute('aria-selected', 'false'); other.classList.remove('selected'); }
    const selected = multi ? item.getAttribute('aria-selected') !== 'true' : true;
    item.setAttribute('aria-selected', String(selected)); item.classList.toggle('selected', selected);
    const box = item.querySelector('material-checkbox');
    if (box) { item.setAttribute('aria-checked', String(selected)); box.setAttribute('aria-checked', String(selected)); box.querySelector('i').textContent = selected ? 'check_box' : 'check_box_outline_blank'; }
    const labels = [...pane.querySelectorAll('[role=option][aria-selected=true] .label')].map((l) => l.textContent);
    button.querySelector('.button-text').textContent = multi ? labels.length + ' countries' : labels[0];
    document.querySelector('#dropdown-result').textContent = select + '=' + labels.join(',');
    if (!multi) close();
  });
};
wire('publishing', 'default-1', 'list-publishing');
wire('countries', 'default-2', 'list-countries');
</script>`,
  "/components/acx-questionnaire": `<!doctype html><meta charset="utf-8"><title>ACX questionnaire</title>
<style>
.material-icons{font-family:'Material Icons';font-style:normal;font-size:24px;line-height:1;display:inline-block;width:24px;height:24px;overflow:hidden;white-space:nowrap;vertical-align:middle}
material-radio,material-checkbox{display:inline-flex;align-items:baseline;cursor:pointer;margin:8px}
material-radio-group{display:block}
.question{margin:12px 0}.question-text{font-weight:500}
.panel .header{display:flex;cursor:pointer;padding:8px;border:1px solid #ccc}
.hidden{display:none}
.material-toggle{display:inline-flex;cursor:pointer;width:36px;height:14px;background:#ccc}
tab-button{display:inline-block;padding:8px;cursor:pointer}
</style>
<h1>Content rating</h1>
<p>Answer every question about your app's content.</p>
<div id="questions"></div>
<material-checkbox class="themeable" role="checkbox" aria-checked="mixed" aria-labelledby="all-label" tabindex="0" aria-disabled="false"><div class="icon-container"><material-icon aria-hidden="true" class="icon filled"><i aria-hidden="true" class="material-icon-i material-icons">indeterminate_check_box</i></material-icon></div><div class="content" id="all-label">Select all countries</div></material-checkbox>
<material-toggle class="themeable"><div class="material-toggle" role="button" tabindex="0" aria-disabled="false" aria-label="" aria-pressed="true"><div class="tgl-lbl">Pre-registration</div><div class="tgl-container"><div class="tgl-bar"></div></div></div></material-toggle>
<material-expansionpanel><div class="panel themeable">
  <header><div class="header closed" buttondecorator role="button" tabindex="0" aria-disabled="false" aria-expanded="false" aria-label="Data safety" aria-describedby="panel-desc" aria-controls="panel-main">
    <div class="panel-name" aria-hidden="true"><p class="primary-text">Data safety</p><p class="secondary-text">Tell us how your app collects user data</p></div>
    <div class="panel-description" id="panel-desc" aria-hidden="true">Not started</div>
    <material-icon class="expand-button"><i aria-hidden="true" class="material-icon-i material-icons">expand_more</i></material-icon>
  </div></header>
  <main class="hidden" role="region" id="panel-main" aria-hidden="true"><div class="content">Does your app collect or share any of the required user data types?</div></main>
</div></material-expansionpanel>
<div class="navi-bar" role="tablist"><tab-button class="tab-button active" role="tab" aria-selected="true" tabindex="0" aria-disabled="false"><div class="content">Main store listing</div></tab-button><tab-button class="tab-button" role="tab" aria-selected="false" tabindex="-1" aria-disabled="false"><div class="content">Custom store listings</div></tab-button></div>
<p id="answers" role="status">0 answered</p>
<script>
const questions = ['Does the app contain violence?', 'Does the app contain blood?', 'Does the app contain sexual content?', 'Does the app contain crude humor?', 'Does the app reference drugs?', 'Does the app reference alcohol?', 'Does the app reference tobacco?', 'Does the app contain gambling?', 'Can users interact with each other?'];
const radio = (label, checked) => '<material-radio class="themeable" role="radio" aria-checked="' + checked + '" tabindex="' + (checked ? 0 : -1) + '" aria-disabled="false"><div class="icon-container' + (checked ? ' checked' : '') + '"><material-icon aria-hidden="true" class="icon"><i aria-hidden="true" class="material-icon-i material-icons">' + (checked ? 'radio_button_checked' : 'radio_button_unchecked') + '</i></material-icon></div><div class="content">' + label + '</div></material-radio>';
document.querySelector('#questions').innerHTML = questions.map((q, i) => '<div class="question" id="q' + (i + 1) + '"><div class="question-text">' + q + '</div><material-radio-group role="radiogroup" tabindex="-1">' + radio('Yes', false) + radio('No', i === 0) + '</material-radio-group></div>').join('');
document.querySelector('#questions').addEventListener('click', (event) => {
  const chosen = event.target.closest('material-radio'); if (!chosen) return;
  for (const other of chosen.parentElement.children) { const on = other === chosen; other.setAttribute('aria-checked', String(on)); other.tabIndex = on ? 0 : -1; other.querySelector('i').textContent = on ? 'radio_button_checked' : 'radio_button_unchecked'; }
  document.querySelector('#answers').textContent = document.querySelectorAll('material-radio[aria-checked=true]').length + ' answered';
});
const header = document.querySelector('.panel .header');
header.addEventListener('click', () => { const open = header.getAttribute('aria-expanded') !== 'true'; header.setAttribute('aria-expanded', String(open)); const main = document.querySelector('#panel-main'); main.classList.toggle('hidden', !open); main.setAttribute('aria-hidden', String(!open)); });
const toggle = document.querySelector('.material-toggle');
toggle.addEventListener('click', () => toggle.setAttribute('aria-pressed', String(toggle.getAttribute('aria-pressed') !== 'true')));
</script>`,
  "/components/acx-fields": `<!doctype html><meta charset="utf-8"><title>ACX fields</title>
<style>
.material-icons{font-family:'Material Icons';font-style:normal;font-size:24px;line-height:1;display:inline-block;width:24px;height:24px;overflow:hidden;white-space:nowrap;vertical-align:middle}
material-input{display:inline-block;margin:8px 0}.input-container{display:block}.label-text.invisible{visibility:hidden}
material-button{display:inline-flex;cursor:pointer;padding:6px 12px;border:1px solid #1a73e8}
.field{margin:12px 0}.field-title{font-weight:500}
</style>
<h1>Main store listing</h1>
<material-input class="themeable" id="app-name"><div class="baseline"><div class="top-section">
  <label class="input-container"><div class="label" aria-hidden="true"><span class="label-text" id="E1C2-label--0">App name</span></div>
  <input class="input" type="text" aria-labelledby="E1C2-label--0" aria-invalid="false" aria-disabled="false" tabindex="0" value="ClickTrack"></label>
</div><div class="underline"></div></div><div class="bottom-section"><div class="counter" aria-label="10 of 30 characters">10/30</div></div></material-input>
<div class="field">
  <div class="field-title">Short description</div>
  <material-input class="themeable"><div class="baseline"><div class="top-section">
    <label class="input-container"><div class="label" aria-hidden="true"><span class="label-text" id="E1C2-label--1"></span></div>
    <input class="input" type="text" aria-labelledby="E1C2-label--1" aria-invalid="false" aria-disabled="false" tabindex="0" value="Count taps quickly"></label>
  </div></div></material-input>
</div>
<div class="field"><span aria-hidden="true">Support email</span><input type="email" id="support-email" value="help@example.test"></div>
<input type="search" title="Search apps" id="search-apps">
<div class="field"><div class="field-title">Full description</div><textarea id="full-description">Tap anywhere to count.</textarea></div>
<div class="field"><div class="field-title">Release notes</div><div contenteditable="true" id="notes" role="textbox" aria-multiline="true">Bug fixes</div></div>
<label for="category">App category</label><select id="category"><option>Tools</option><option selected>Productivity</option></select>
<label for="tags">Tags</label><select id="tags" multiple><option selected>Timer</option><option>Counter</option><option selected>Clicker</option></select>
<label><input type="checkbox" id="ads" checked> Contains ads</label>
<label><input type="checkbox" id="partial"> Some countries</label>
<fieldset><legend>Is your app a game?</legend><label><input type="radio" name="kind" value="app" checked> App</label><label><input type="radio" name="kind" value="game"> Game</label></fieldset>
<div class="question-native"><p>Does your app target children?</p><label><input type="radio" name="kids" value="yes"> Yes</label><label><input type="radio" name="kids" value="no" checked> No</label></div>
<div role="switch" aria-checked="false" tabindex="0" aria-label="Notify me">Notify</div>
<details open><summary>Advanced</summary><p>Advanced options</p></details>
<h2>Sign-in details for review</h2>
<label for="pw">Password</label><input type="password" id="pw" value="pw-secret-123">
<label for="cur">Current password (text field)</label><input type="text" id="cur" autocomplete="current-password" value="cur-secret-456">
<label for="newpw">New password</label><input id="newpw" autocomplete="new-password" value="new-secret-789">
<label for="otp">Code</label><input id="otp" autocomplete="one-time-code" value="otp-secret-000">
<label for="card">Card number</label><input id="card" autocomplete="section-pay billing cc-number" value="card-secret-4111">
<label for="csc">Security code</label><input id="csc" autocomplete="cc-csc" value="csc-secret-123">
<label for="shown">Account password</label><input type="password" id="shown" value="shown-secret-321"><button type="button" id="show-password">Show password</button>
<label for="transfer">Transfer code</label><input id="transfer" name="transfer_pin" value="pin-secret-555">
<div class="question-custom"><p>Tester notes</p><div role="textbox" tabindex="0" id="notes">custom-note-value</div></div>
<material-button role="button" tabindex="0" aria-disabled="false" id="upload"><div class="content"><material-icon icon="upload"><i aria-hidden="true" class="material-icon-i material-icons">upload</i></material-icon>Upload</div><material-ripple></material-ripple></material-button>
<material-button role="button" tabindex="0" aria-disabled="false" id="more"><div class="content"><material-icon icon="more_vert"><i aria-hidden="true" class="material-icon-i material-icons">more_vert</i></material-icon></div></material-button>
<p id="field-result" role="status">No changes</p>
<script>
document.querySelector('#partial').indeterminate = true;
document.querySelector('#show-password').onclick = () => { document.querySelector('#shown').type = 'text'; };
document.addEventListener('input', (event) => { document.querySelector('#field-result').textContent = (event.target.id || 'field') + ' changed'; });
</script>`,
  "/components/acx-budget": `<!doctype html><meta charset="utf-8"><title>ACX control budget</title>
<style>
body{margin:0;font:14px sans-serif}
material-drawer{position:absolute;top:0;bottom:0;left:0;width:256px;overflow:hidden;display:flex;flex-direction:column}
material-drawer material-list{overflow:auto;display:block}
material-list-item{display:block;padding:4px 16px;cursor:pointer}
.material-content{margin-left:256px;display:block;min-height:100%;position:relative;padding:0 16px}
.bottom-bar{position:sticky;bottom:0;background:#fff;border-top:1px solid #ccc;padding:8px;display:flex;gap:8px;justify-content:flex-end}
material-button{display:inline-flex;cursor:pointer;padding:6px 12px;border:1px solid #1a73e8}
.acx-overlay-container{position:absolute;pointer-events:none;top:0;left:0;width:100%;height:100%;z-index:10}
.acx-overlay-container>.pane{display:flex;position:absolute;z-index:11;pointer-events:none}
.acx-overlay-container>.pane>*{pointer-events:auto}
.acx-overlay-container>.pane.modal{justify-content:center;align-items:center;background:rgba(33,33,33,.4);pointer-events:auto;position:fixed}
material-dialog{background:#fff;padding:16px;display:block}
</style>
<material-drawer permanent><material-list id="nav"></material-list></material-drawer>
<div class="material-content">
  <h1>Store settings</h1>
  <p>Changes are saved as a draft until you send them for review.</p>
  <div id="rows"></div>
  <div class="bottom-bar">
    <material-button role="button" tabindex="0" aria-disabled="false" id="discard"><div class="content">Discard changes</div></material-button>
    <material-button role="button" tabindex="0" aria-disabled="false" id="save"><div class="content">Save</div></material-button>
    <material-button role="button" tabindex="0" aria-disabled="false" id="review"><div class="content">Send for review</div></material-button>
  </div>
</div>
<p id="budget-result" role="status">Nothing saved</p>
<div class="acx-overlay-container" id="default-acx-overlay-container" name="default">
  <div pane-id="default-7" class="pane modal" style="display:none;inset:0">
    <material-dialog role="dialog" aria-modal="true" class="headered-dialog" aria-labelledby="dialog-header">
      <focus-trap><div tabindex="0"></div><div focuscontentwrapper tabindex="-1" style="outline:none"><div class="wrapper">
        <header role="presentation" id="dialog-header"><div header><h1>Send changes for review?</h1></div></header>
        <main role="presentation"><p>Your changes will be reviewed before they are published.</p></main>
        <footer role="presentation"><div footer>
          <material-button role="button" tabindex="0" aria-disabled="false" id="dialog-cancel"><div class="content">Cancel</div></material-button>
          <material-button role="button" tabindex="0" aria-disabled="false" id="dialog-send"><div class="content">Send changes for review</div></material-button>
        </div></footer>
      </div></div><div tabindex="0"></div></focus-trap>
    </material-dialog>
  </div>
</div>
<script>
document.querySelector('#nav').innerHTML = Array.from({ length: 120 }, (_, i) => '<a href="#section-' + i + '" style="display:block;padding:4px 16px">Section ' + (i + 1) + '</a>').join('');
document.querySelector('#rows').innerHTML = Array.from({ length: 30 }, (_, i) => '<p><label>Setting ' + (i + 1) + ' <input type="checkbox"></label></p>').join('');
const pane = document.querySelector('[pane-id="default-7"]');
const result = (text) => { document.querySelector('#budget-result').textContent = text; };
document.querySelector('#save').addEventListener('click', () => result('Saved'));
document.querySelector('#discard').addEventListener('click', () => result('Discarded'));
document.querySelector('#review').addEventListener('click', () => { pane.style.display = 'flex'; pane.classList.add('visible'); });
document.querySelector('#dialog-cancel').addEventListener('click', () => { pane.style.display = 'none'; pane.classList.remove('visible'); result('Review cancelled'); });
document.querySelector('#dialog-send').addEventListener('click', () => { pane.style.display = 'none'; pane.classList.remove('visible'); result('Sent for review'); });
</script>`,
  "/components/mui-select": `<!doctype html><meta charset="utf-8"><title>MUI controls</title>
<style>
.MuiInputBase-root{position:relative;display:inline-flex;min-width:160px;border:1px solid #999}
.MuiSelect-select{padding:8px 32px 8px 8px;cursor:pointer;min-height:1.4em;flex:1}
.MuiSelect-nativeInput{bottom:0;left:0;position:absolute;opacity:0;pointer-events:none;width:100%;box-sizing:border-box}
.MuiSvgIcon-root{width:24px;height:24px}
.MuiButtonBase-root{position:relative;display:inline-flex;cursor:pointer;padding:9px}
.PrivateSwitchBase-input{cursor:inherit;position:absolute;opacity:0;width:100%;height:100%;top:0;left:0;margin:0;padding:0;z-index:1}
.MuiModal-root{position:fixed;z-index:1300;inset:0}
.MuiBackdrop-invisible{position:fixed;inset:0;background:transparent}
.MuiPopover-paper{position:absolute;background:#fff;box-shadow:0 4px 12px #0004;max-height:200px;overflow:auto;min-width:160px}
.MuiMenuItem-root{display:flex;padding:6px 16px;cursor:pointer}
.Mui-selected{background:#e3f2fd}
</style>
<div id="root">
  <h1>Checkout</h1>
  <div class="MuiFormControl-root" id="age-control">
    <label class="MuiFormLabel-root MuiInputLabel-root" data-shrink="true" id="age-label">Age</label>
    <div class="MuiInputBase-root MuiOutlinedInput-root">
      <div tabindex="0" role="combobox" aria-controls="age-listbox" aria-expanded="false" aria-haspopup="listbox" aria-labelledby="age-label" id="age-select" class="MuiSelect-select MuiSelect-outlined">Twenty</div>
      <input aria-invalid="false" name="age" aria-hidden="true" tabindex="-1" class="MuiSelect-nativeInput" value="20">
      <svg class="MuiSvgIcon-root MuiSelect-icon" focusable="false" aria-hidden="true" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"></path></svg>
    </div>
  </div>
  <label class="MuiFormControlLabel-root"><span class="MuiButtonBase-root MuiCheckbox-root MuiCheckbox-indeterminate PrivateSwitchBase-root"><input type="checkbox" data-indeterminate="true" aria-checked="mixed" class="PrivateSwitchBase-input" id="parent-box"><svg class="MuiSvgIcon-root" focusable="false" aria-hidden="true" viewBox="0 0 24 24"><path d="M19 3H5v18h14z"></path></svg></span><span class="MuiTypography-root MuiFormControlLabel-label">Parent</span></label>
  <div class="MuiFormControl-root">
    <label class="MuiFormLabel-root" id="gender-label">Gender</label>
    <div class="MuiFormGroup-root MuiRadioGroup-root" role="radiogroup" aria-labelledby="gender-label">
      <label class="MuiFormControlLabel-root"><span class="MuiButtonBase-root MuiRadio-root Mui-checked PrivateSwitchBase-root"><input type="radio" class="PrivateSwitchBase-input" name="radio-buttons-group" value="female" checked><span><svg class="MuiSvgIcon-root" focusable="false" aria-hidden="true" viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20z"></path></svg></span></span><span class="MuiTypography-root MuiFormControlLabel-label">Female</span></label>
      <label class="MuiFormControlLabel-root"><span class="MuiButtonBase-root MuiRadio-root PrivateSwitchBase-root"><input type="radio" class="PrivateSwitchBase-input" name="radio-buttons-group" value="male"><span><svg class="MuiSvgIcon-root" focusable="false" aria-hidden="true" viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20z"></path></svg></span></span><span class="MuiTypography-root MuiFormControlLabel-label">Male</span></label>
    </div>
  </div>
  <p id="mui-result" role="status">Age 20</p>
</div>
<script>
document.querySelector('#parent-box').indeterminate = true;
const display = document.querySelector('#age-select');
let menu = null;
const close = () => { menu?.remove(); menu = null; display.setAttribute('aria-expanded', 'false'); display.removeAttribute('aria-controls'); document.querySelector('#root').removeAttribute('aria-hidden'); };
// MUI opens the select on mousedown, portals the menu to the end of body, and
// hides every other child of body from assistive technology while it is open.
display.addEventListener('mousedown', (event) => {
  if (event.button !== 0) return; event.preventDefault();
  const value = document.querySelector('.MuiSelect-nativeInput').value;
  menu = document.createElement('div');
  menu.setAttribute('role', 'presentation'); menu.id = 'menu-age'; menu.className = 'MuiPopover-root MuiMenu-root MuiModal-root';
  menu.innerHTML = '<div class="MuiBackdrop-root MuiBackdrop-invisible MuiModal-backdrop" aria-hidden="true"></div><div tabindex="0" data-testid="sentinelStart"></div>' +
    '<div class="MuiPaper-root MuiPopover-paper MuiMenu-paper" tabindex="-1" style="top:' + (display.getBoundingClientRect().bottom) + 'px;left:' + display.getBoundingClientRect().left + 'px">' +
    '<ul class="MuiList-root MuiMenu-list" role="listbox" tabindex="-1" aria-labelledby="age-label" id="age-listbox">' +
    [['10', 'Ten'], ['20', 'Twenty'], ['30', 'Thirty']].map(([v, l]) => '<li class="MuiButtonBase-root MuiMenuItem-root' + (v === value ? ' Mui-selected' : '') + '" tabindex="' + (v === value ? 0 : -1) + '" role="option" aria-selected="' + (v === value) + '" data-value="' + v + '">' + l + '</li>').join('') +
    '</ul></div><div tabindex="0" data-testid="sentinelEnd"></div>';
  document.body.append(menu);
  document.querySelector('#root').setAttribute('aria-hidden', 'true');
  display.setAttribute('aria-expanded', 'true'); display.setAttribute('aria-controls', 'age-listbox');
  menu.querySelector('.MuiBackdrop-root').addEventListener('click', close);
  menu.querySelectorAll('[role=option]').forEach((option) => option.addEventListener('click', () => {
    document.querySelector('.MuiSelect-nativeInput').value = option.dataset.value; display.textContent = option.textContent;
    document.querySelector('#mui-result').textContent = 'Age ' + option.dataset.value; close();
  }));
});
</script>`,
  "/components/acx-tree": `<!doctype html><meta charset="utf-8"><title>ACX tree</title>
<style>
.material-icons{font-family:'Material Icons';font-style:normal;font-size:24px;line-height:1;display:inline-block;width:24px;height:24px;overflow:hidden;white-space:nowrap;vertical-align:middle}
material-tree,material-tree-group{display:block}
material-tree-group ul{list-style:none;margin:0;padding:0}
.material-tree-option{cursor:pointer}
.material-tree-shift{display:flex;align-items:center;gap:8px;padding:4px 0}
material-checkbox,material-icon{display:inline-flex}
.tree-expansion-state{cursor:pointer}
.tabs{display:flex;gap:8px;margin-top:16px}
[role=tab]{display:inline-flex;align-items:center;gap:4px;padding:8px;border:1px solid #ccc;cursor:pointer}
</style>
<h1>Countries and regions</h1>
<material-tree role="tree" aria-multiselectable="true" aria-readonly="false" id="regions"></material-tree>
<div role="tablist" class="tabs">
  <div role="tab" aria-selected="true" tabindex="0">Main store listing<span role="button" tabindex="0" aria-label="Close Main store listing" class="close"><i aria-hidden="true" class="material-icons">close</i></span></div>
  <div role="tab" aria-selected="false" tabindex="-1">Custom store listing<span role="button" tabindex="0" aria-label="Close Custom store listing" class="close"><i aria-hidden="true" class="material-icons">close</i></span></div>
</div>
<p id="tree-result" role="status">Nothing changed</p>
<script>
// material-tree-group renders each option as an li with buttonDecorator, which
// makes it a button, around a treeitem. A parent's expand icon is a second
// buttonDecorator, and its children render inside the li once it expands.
const regions = { Europe: ['France', 'Germany'], Asia: ['India', 'Japan'] };
const expanded = new Set(), selected = new Set(['France']);
const option = (name, level, children) => '<li buttondecorator role="button" tabindex="0" aria-disabled="false" class="material-tree-option' + (selected.has(name) ? ' selected' : '') + '" data-name="' + name + '">' +
  '<div class="material-tree-item" role="treeitem" aria-selected="' + selected.has(name) + '" style="padding-left:' + level * 24 + 'px"><div class="material-tree-shift">' +
  '<div class="tree-selection-state"><material-checkbox class="tree-selection-state themeable" role="checkbox" tabindex="0" aria-checked="' + selected.has(name) + '" aria-disabled="false"><div class="icon-container"><material-icon class="icon" aria-hidden="true"><i aria-hidden="true" class="material-icon-i material-icons">' + (selected.has(name) ? 'check_box' : 'check_box_outline_blank') + '</i></material-icon></div><div class="content"></div></material-checkbox></div>' +
  '<div class="material-tree-border' + (children ? ' is-parent' : '') + '"></div><span class="text item">' + name + '</span>' +
  (children ? '<material-icon buttondecorator role="button" tabindex="0" aria-disabled="false" class="tree-expansion-state' + (expanded.has(name) ? ' expanded' : '') + '"><i aria-hidden="true" class="material-icon-i material-icons">' + (expanded.has(name) ? 'expand_less' : 'expand_more') + '</i></material-icon>' : '') +
  '</div></div>' +
  (children && expanded.has(name) ? '<material-tree-group role="group" class="child-tree material-tree-group"><ul>' + children.map((child) => option(child, level + 1)).join('') + '</ul></material-tree-group>' : '') + '</li>';
const render = () => { document.querySelector('#regions').innerHTML = '<material-tree-group role="group" class="material-tree-group"><ul>' + Object.entries(regions).map(([name, children]) => option(name, 0, children)).join('') + '</ul></material-tree-group>'; };
render();
const result = (text) => { document.querySelector('#tree-result').textContent = text; };
document.querySelector('#regions').addEventListener('click', (event) => {
  const row = event.target.closest('.material-tree-option'); if (!row) return;
  const name = row.dataset.name;
  if (event.target.closest('.tree-expansion-state')) { expanded.has(name) ? expanded.delete(name) : expanded.add(name); result((expanded.has(name) ? 'Expanded ' : 'Collapsed ') + name); }
  else { selected.has(name) ? selected.delete(name) : selected.add(name); result('Selected ' + [...selected].join(', ')); }
  render();
});
for (const close of document.querySelectorAll('.close')) close.addEventListener('click', (event) => { event.stopPropagation(); const tab = close.closest('[role=tab]'); result('Closed ' + tab.firstChild.textContent); tab.remove(); });
</script>`,
  "/components/mat-select": `<!doctype html><meta charset="utf-8"><title>Angular Material select</title>
<style>
body{font:14px sans-serif;margin:16px}
mat-form-field{display:inline-block;margin:8px 0}
.mat-mdc-select{display:inline-block;width:200px;border-bottom:1px solid #666;cursor:pointer}
.mat-mdc-select-trigger{display:flex;align-items:center;padding:8px 0}
.mat-mdc-select-value{flex:1}
.cdk-overlay-popover{position:fixed;inset:auto;margin:0;padding:0;border:0;background:transparent;overflow:visible}
.cdk-overlay-backdrop{position:fixed;inset:0}
.cdk-overlay-pane{position:relative;background:#fff;box-shadow:0 2px 6px #0004}
mat-option{display:flex;padding:8px 16px;cursor:pointer}
mat-option[aria-selected=true]{background:#e8f0fe}
</style>
<h1>Your order</h1>
<mat-form-field class="mat-mdc-form-field mat-mdc-form-field-type-mat-select"><div class="mat-mdc-text-field-wrapper"><div class="mat-mdc-form-field-flex"><div class="mat-mdc-form-field-infix">
  <label class="mdc-floating-label mat-mdc-floating-label" id="mat-mdc-form-field-label-0"><mat-label>Favorite food</mat-label></label>
  <mat-select role="combobox" aria-haspopup="listbox" class="mat-mdc-select" aria-labelledby="mat-mdc-form-field-label-0" id="mat-select-0" tabindex="0" aria-expanded="false" aria-required="false" aria-disabled="false" aria-invalid="false"><div cdk-overlay-origin class="mat-mdc-select-trigger"><div class="mat-mdc-select-value" id="mat-select-value-0"><span class="mat-mdc-select-value-text"><span class="mat-mdc-select-min-line">Tacos</span></span></div><div class="mat-mdc-select-arrow-wrapper"><div class="mat-mdc-select-arrow"><svg viewBox="0 0 24 24" width="24px" height="24px" focusable="false" aria-hidden="true"><path d="M7 10l5 5 5-5z"></path></svg></div></div></div></mat-select>
</div></div></div></mat-form-field>
<p id="food-result" role="status">Chose Tacos</p>
<script>
// The CDK overlay inserts the panel in a manual popover inside the select,
// with a transparent backdrop, and removes it once the panel closes.
const select = document.querySelector('#mat-select-0');
let chosen = 'Tacos';
const close = () => { select.querySelector('.cdk-overlay-popover')?.remove(); select.setAttribute('aria-expanded', 'false'); select.removeAttribute('aria-controls'); select.classList.remove('mat-select-open'); };
select.addEventListener('click', (event) => {
  const option = event.target.closest('mat-option');
  if (option) {
    chosen = option.textContent;
    select.querySelector('.mat-mdc-select-min-line').textContent = chosen;
    document.querySelector('#food-result').textContent = 'Chose ' + chosen;
    return close();
  }
  if (event.target.closest('.cdk-overlay-backdrop')) return close();
  if (select.querySelector('.cdk-overlay-popover')) return;
  const box = select.getBoundingClientRect();
  select.insertAdjacentHTML('beforeend', '<div popover="manual" class="cdk-overlay-popover cdk-overlay-connected-position-bounding-box" dir="ltr" style="top:' + box.bottom + 'px;left:' + box.left + 'px"><div class="cdk-overlay-backdrop cdk-overlay-transparent-backdrop cdk-overlay-backdrop-showing"></div><div id="cdk-overlay-0" class="cdk-overlay-pane" style="width:' + box.width + 'px"><div role="listbox" tabindex="-1" class="mat-mdc-select-panel mdc-menu-surface mdc-menu-surface--open" id="mat-select-0-panel" aria-labelledby="mat-mdc-form-field-label-0">' +
    ['None', 'Steak', 'Pizza', 'Tacos'].map((food, i) => '<mat-option role="option" class="mat-mdc-option mdc-list-item" id="mat-option-' + i + '" aria-selected="' + (food === chosen) + '" aria-disabled="false"><span class="mdc-list-item__primary-text">' + food + '</span><div aria-hidden="true" mat-ripple class="mat-ripple mat-mdc-option-ripple mat-focus-indicator"></div></mat-option>').join('') +
    '</div></div></div>');
  select.querySelector('.cdk-overlay-popover').showPopover();
  select.setAttribute('aria-expanded', 'true'); select.setAttribute('aria-controls', 'mat-select-0-panel'); select.classList.add('mat-select-open');
});
</script>`,
  "/components/docs-layout": `<!doctype html><meta charset="utf-8"><title>Docs layout</title>
<style>
body{margin:0;font:14px sans-serif}
.MuiAppBar-root{position:fixed;top:0;left:240px;right:0;height:56px;display:flex;gap:8px;align-items:center;padding:0 16px;background:#fff;border-bottom:1px solid #ddd;z-index:2}
.MuiDrawer-paper{position:fixed;top:0;left:0;bottom:0;width:240px;overflow-y:auto;border-right:1px solid #ddd}
.MuiDrawer-paper a{display:block;padding:4px 16px}
main{margin:64px 0 0 256px;display:flex;gap:16px}
.content{flex:1}
.toc{position:sticky;top:56px;height:calc(100vh - 56px);overflow-y:auto;width:200px;flex:none}
.toc a{display:block;padding:2px 0}
.cookies{position:fixed;right:16px;bottom:16px;width:320px;padding:16px;background:#fff;box-shadow:0 2px 8px #0004}
</style>
<header class="MuiAppBar-root"><button type="button">Search</button><button type="button" aria-label="Toggle dark mode">brightness</button><a href="#github">GitHub</a></header>
<nav class="MuiDrawer-paper" aria-label="Documentation" id="drawer"></nav>
<main>
  <div class="content">
    <h1>Switch</h1>
    <p>Switches toggle the state of a single setting on or off.</p>
    <div id="switches"></div>
    <p><button type="button">View as Markdown</button> <button type="button">Feedback</button> <button type="button">Source</button></p>
    <p id="docs-result" role="status">Nothing changed</p>
    <div style="margin-top:1600px" id="later"></div>
  </div>
  <nav class="toc" aria-label="Contents" id="toc"></nav>
</main>
<div class="cookies" role="region" aria-label="Cookie consent"><p>We use cookies to improve the site.</p><button type="button">Allow all</button> <button type="button">Essential only</button></div>
<script>
// The MUI documentation pins its navigation drawer and app bar with
// position:fixed and its table of contents with position:sticky, both as
// tall as the viewport, beside the page. Its switches are native checkbox
// inputs with role=switch inside FormControlLabel.
document.querySelector('#drawer').innerHTML = Array.from({ length: 60 }, (_, i) => '<a href="#page-' + (i + 1) + '">Component ' + (i + 1) + '</a>').join('');
document.querySelector('#toc').innerHTML = Array.from({ length: 12 }, (_, i) => '<a href="#section-' + (i + 1) + '">Section ' + (i + 1) + '</a>').join('');
document.querySelector('#switches').innerHTML = ['Wi-Fi', 'Bluetooth', 'Location', 'Airplane mode'].map((name, i) => '<label class="MuiFormControlLabel-root"><span class="MuiSwitch-root"><span class="MuiSwitch-switchBase"><input class="MuiSwitch-input PrivateSwitchBase-input" type="checkbox" role="switch"' + (i < 2 ? ' checked' : '') + '><span class="MuiSwitch-thumb"></span></span><span class="MuiSwitch-track"></span></span><span class="MuiFormControlLabel-label">' + name + '</span></label> ').join('');
document.querySelector('#later').innerHTML = Array.from({ length: 10 }, (_, i) => '<button type="button">Example ' + (i + 1) + '</button>').join('');
document.querySelector('#switches').addEventListener('change', (event) => { document.querySelector('#docs-result').textContent = event.target.parentElement.closest('label').textContent + (event.target.checked ? ' on' : ' off'); });
</script>`,
};
