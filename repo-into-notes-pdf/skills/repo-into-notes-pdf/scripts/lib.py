"""Helpers for writing guide Parts. Import in each part_*.py:

    from lib import part, step, p, code, table, note, ul, diagram, c

All helpers return HTML strings; part() and step() append to the document.
"""
import html as _html
import textwrap

from pygments import highlight
from pygments.formatters import HtmlFormatter
from pygments.lexers import get_lexer_by_name
from pygments.util import ClassNotFound

COLORS = {
    "overview": "#64748b", "backend": "#2563eb", "frontend": "#7c3aed", "mobile": "#0891b2",
    "database": "#0d9488", "security": "#059669", "devops": "#d97706", "testing": "#db2777",
    "reference": "#475569",
}
LABELS = {"tip": "Tip", "why": "Why", "warn": "Watch out", "repo": "vs. the repo", "info": "Note"}

_fmt = HtmlFormatter(style="github-dark", nowrap=True)
OUT: list[str] = []
TOC: list[tuple] = []
_n = [0]


def reset():
    OUT.clear(); TOC.clear(); _n[0] = 0


def esc(s: str) -> str:
    return _html.escape(s, quote=False)


def c(s: str) -> str:
    """Inline code: c('req.user')"""
    return f"<code>{esc(s)}</code>"


def code(src: str, lang: str = "ts", file: str | None = None) -> str:
    src = textwrap.dedent(src).strip("\n")
    try:
        body = highlight(src, get_lexer_by_name(lang), _fmt)
    except ClassNotFound:
        body = esc(src)
    return f'<div class="code"><div class="file">{esc(file or lang)}</div><pre>{body}</pre></div>'


def diagram(src: str, title: str = "diagram") -> str:
    src = textwrap.dedent(src).strip("\n")
    return f'<div class="code diagram"><div class="file">{esc(title)}</div><pre>{esc(src)}</pre></div>'


def table(rows, head=None, cls: str = "") -> str:
    h = "<thead><tr>" + "".join(f"<th>{x}</th>" for x in head) + "</tr></thead>" if head else ""
    b = "".join("<tr>" + "".join(f"<td>{x}</td>" for x in r) + "</tr>" for r in rows)
    return f'<table class="{cls}">{h}<tbody>{b}</tbody></table>'


def note(html: str, kind: str = "tip") -> str:
    return f'<div class="note {kind}"><b>{LABELS[kind]}</b>{html}</div>'


def ul(items, check: bool = False) -> str:
    cls = ' class="check"' if check else ""
    return f"<ul{cls}>" + "".join(f"<li>{i}</li>" for i in items) + "</ul>"


def p(html: str) -> str:
    return f"<p>{html}</p>"


def part(letter: str, title: str, sub: str, color: str = "overview"):
    color = COLORS.get(color, color)
    TOC.append(("part", letter, title, color))
    OUT.append(
        f'<section class="part" style="--c:{color}"><div class="part-letter">Part {letter}</div>'
        f"<h1>{title}</h1><p>{sub}</p></section>"
    )


def step(title: str, *blocks: str):
    _n[0] += 1
    n = f"{_n[0]:02d}"
    TOC.append(("step", n, title, None))
    rest = list(blocks)
    intro = rest.pop(0) if rest and rest[0].startswith("<p>") else ""
    OUT.append(
        f'<section class="step"><div class="head"><h2><span class="n">STEP {n}</span>{title}</h2>{intro}</div>'
        f'{"".join(rest)}</section>'
    )
