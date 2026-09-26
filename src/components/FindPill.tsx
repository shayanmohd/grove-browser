import { useState } from "react";
import {
  CaretDown,
  CaretUp,
  MagnifyingGlass,
  X,
} from "@phosphor-icons/react";
import type { BrowserAction } from "../../shared/types";
import { IconButton } from "./ui";
import "./FindPill.css";

export function FindPill({
  dispatch,
  onClose,
}: {
  dispatch: (action: BrowserAction) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  return (
    // Native pages draw above the shell, so the pill sits just above the page.
    <div className="find-band">
      <form
        className="find-pill"
        role="search"
        aria-label="Find in page"
        onSubmit={(event) => {
          event.preventDefault();
          dispatch({ type: "page:find", text, forward: true });
        }}
      >
        <MagnifyingGlass size={14} />
        <input
          autoFocus
          aria-label="Find in page"
          placeholder="Find in page"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            dispatch(
              event.target.value
                ? { type: "page:find", text: event.target.value }
                : { type: "page:stop-find" },
            );
          }}
        />
        <IconButton
          label="Previous match"
          onClick={() => dispatch({ type: "page:find", text, forward: false })}
        >
          <CaretUp size={14} />
        </IconButton>
        <IconButton
          label="Next match"
          onClick={() => dispatch({ type: "page:find", text, forward: true })}
        >
          <CaretDown size={14} />
        </IconButton>
        <IconButton label="Close find" onClick={onClose}>
          <X size={14} />
        </IconButton>
      </form>
    </div>
  );
}
