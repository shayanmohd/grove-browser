export const edgeCases = {
  body: `<h1>Browser edge cases</h1>
    <section id="visibility"><p>Visible start<br>Visible end</p>
      <p hidden>Hidden secret</p><p aria-hidden="true">Aria secret</p><p inert>Inert secret</p>
      <div style="opacity:0"><p>Transparent secret</p><button>Invisible button</button></div>
      <div style="content-visibility:hidden"><p>Skipped secret</p></div>
      <textarea aria-label="Private draft">Draft secret</textarea>
      <div contenteditable="" aria-label="Rich editor">Rich secret</div>
      <div contenteditable="plaintext-only" aria-label="Plain editor">Plain secret</div>
      <details><summary>Open details</summary><p>Disclosure revealed</p></details>
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
  script: `document.querySelector('#focus-readonly').onfocus=event=>{event.target.readOnly=true;};
    document.querySelector('#focus-replace').onfocus=event=>{event.target.outerHTML='<input id="focus-replace" value="replacement">';};
    document.querySelector('#fields').addEventListener('input',event=>{document.querySelector('#field-result').textContent=event.target.id+'='+event.target.value;});
    document.querySelectorAll('[contenteditable]').forEach(element=>element.oninput=()=>{document.querySelector('#field-result').textContent=element.getAttribute('aria-label')+'='+element.textContent;});`,
};
