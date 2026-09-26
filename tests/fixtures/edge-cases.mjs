export const edgeCases = {
  body: `<h1>Browser edge cases</h1>
    <section id="visibility"><p>Visible start<br>Visible end</p>
      <p hidden>Hidden secret</p><p aria-hidden="true">Aria secret</p><p aria-hidden="true" style="visibility:hidden">Mirror secret</p><p inert>Inert secret</p>
      <div style="opacity:0"><p>Transparent secret</p><button>Invisible button</button></div>
      <div style="content-visibility:hidden"><p>Skipped secret</p></div>
      <textarea aria-label="Private draft">Draft secret</textarea>
      <div contenteditable="" aria-label="Rich editor">Rich secret</div>
      <div contenteditable="plaintext-only" aria-label="Plain editor">Plain secret</div>
      <details><summary>Open details</summary><p>Disclosure revealed</p></details>
    </section>
    <section id="material">
      <span style="position:relative;display:inline-block;width:20px;height:20px">
        <input type="checkbox" id="material-agree" style="position:absolute;inset:0;margin:0;width:100%;height:100%;opacity:0;z-index:1">
        <span style="display:block;box-sizing:border-box;width:20px;height:20px;border:2px solid #36593e"></span>
      </span>
      <label for="material-agree">Material agreement</label>
      <p id="material-result" role="status">Material unchecked</p>
    </section>
    <section id="custom">
      <div id="chip" style="display:inline-block;cursor:pointer;padding:4px 10px;border:1px solid #36593e">Filter: <b>Active</b></div>
      <div style="cursor:pointer"><a href="#custom">Linked row</a></div>
      <x-card tabindex="0"><button type="button">Card action</button></x-card>
      <div aria-haspopup="menu"><button type="button">Wrapped menu</button></div>
      <p id="custom-result" role="status">No chip chosen</p>
    </section>
    <section id="fields">
      <input type="submit" value="Save caption"><input type="button" value="Action caption">
      <label for="numeric">Numeric input</label><input id="numeric" type="number" value="5">
      <label for="date">Date input</label><input id="date" type="date" value="2026-09-11">
      <label for="range">Range input</label><input id="range" type="range">
      <label for="color">Color input</label><input id="color" type="color">
      <label for="choice">Option choice</label><select id="choice">
        <option value="first">First</option><optgroup label="Unavailable" disabled><option value="blocked">Blocked option</option></optgroup>
        <option value="duplicate">Duplicate one</option><option value="duplicate">Duplicate two</option><option value="last">Last</option>
      </select>
      <label for="multiple">Multiple choices</label><select id="multiple" multiple><option value="a">A</option></select>
      <label for="focus-readonly">Becomes read only</label><input id="focus-readonly" value="original">
      <label for="focus-replace">Replaced on focus</label><input id="focus-replace" value="original">
      <p id="field-result" role="status">No fields changed</p>
    </section>
    <form method="post" target="_blank" action="/popup-receipt" id="urlencoded-popup">
      <label for="popup-text">Popup message</label><input id="popup-text" name="message" required>
      <input type="submit" value="Submit popup">
    </form>
    <form method="post" target="_blank" action="/popup-receipt" enctype="multipart/form-data" id="multipart-popup">
      <label for="multipart-text">Multipart message</label><input id="multipart-text" name="message" required>
      <input type="submit" value="Submit multipart">
    </form>`,
  script: `document.querySelector('#chip').onclick=()=>{document.querySelector('#custom-result').textContent='Chip chosen';};document.querySelector('#material-agree').onchange=event=>{document.querySelector('#material-result').textContent=event.target.checked?'Material checked':'Material unchecked';};document.querySelector('#focus-readonly').onfocus=event=>{event.target.readOnly=true;};
    document.querySelector('#focus-replace').onfocus=event=>{event.target.outerHTML='<input id="focus-replace" value="replacement">';};
    document.querySelector('#fields').addEventListener('input',event=>{document.querySelector('#field-result').textContent=event.target.id+'='+event.target.value;});
    document.querySelectorAll('[contenteditable]').forEach(element=>element.oninput=()=>{document.querySelector('#field-result').textContent=element.getAttribute('aria-label')+'='+element.textContent;});`,
};
