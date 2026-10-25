// A small layer over the document: the page builds its nodes only with these functions
// and with the text of a node, never with a string of markup, so a text of a tenant or
// of the server is always shown as letters.

// el(tag, attrs, ...children) -> a new node. A value of `attrs` is a string (a number
// is turned into one); null and undefined are skipped. A child is a string or a node;
// null and undefined are skipped.
export function el(tag, attrs, ...children) {
  const node = document.createElement(tag);
  if (attrs !== null && attrs !== undefined) {
    for (const name of Object.keys(attrs)) {
      const value = attrs[name];
      if (value === null || value === undefined) continue;
      node.setAttribute(name, String(value));
    }
  }
  for (const child of children) {
    if (child === null || child === undefined) continue;
    node.append(child);
  }
  return node;
}

// part(tag, name, attrs, ...children) -> the same with data-part="name", the mark by
// which a test and a check of the page find the node.
export function part(tag, name, attrs, ...children) {
  return el(tag, { ...attrs, "data-part": name }, ...children);
}

// The text of a node is replaced as a whole.
export function setText(node, text) {
  node.textContent = text;
}
