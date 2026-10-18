"""Derive disclosure structure without rewriting or discarding source text."""
import html
import re


def plain(value):
    return html.unescape(re.sub(r'<[^>]+>', '', value))


def split_item(text, source_count=1):
    # Prefer a lead sentence or colon; single-sentence points use a clause.
    boundary = next((m for m in re.finditer(r'[：。]', text) if text[m.end():].strip()), None)
    if boundary is None:
        boundary = next((m for m in re.finditer(r'[；，]', text) if text[m.end():].strip()), None)
    assert boundary is not None, ('No nonempty disclosure body', text)
    return {'title': text[:boundary.end()],
            'bodyHtml': '<p>' + html.escape(text[boundary.end():]) + '</p>',
            'sourceItemCount': source_count}


def structure(section):
    blocks = [(tag, plain(value)) for tag, value in re.findall(r'<(li|p)>(.*?)</\1>', section['html'], re.S)]
    items = []
    index = 0
    while index < len(blocks):
        tag, text = blocks[index]
        assert tag == 'li', ('Unassigned source paragraph', text)
        if text in ('三项设计能力：', '人机分工随阶段变化：'):
            children = blocks[index+1:index+4]
            assert len(children) == 3
            if text == '三项设计能力：':
                assert all(t == 'p' and v.startswith(prefix) for (t, v), prefix in zip(children, ['a. 决策力：', 'b. 系统力：', 'c. 想象力：']))
            else:
                assert all(t == 'li' and v.startswith(prefix) for (t, v), prefix in zip(children, ['前期研究与产品定义：', '设计表达：', '方案验证与输出：']))
            items.append({'title': text, 'bodyHtml': '', 'sourceItemCount': 1,
                          'children': [split_item(value, 1 if kind == 'li' else 0) for kind, value in children]})
            index += 4
        else:
            items.append(split_item(text))
            index += 1
    return items


def enrich(personal):
    for section in personal[1:3]:
        section['items'] = structure(section)
    personal[3]['keywords'] = [word.strip() for word in plain(personal[3]['html']).split('；') if word.strip()]
    return personal
