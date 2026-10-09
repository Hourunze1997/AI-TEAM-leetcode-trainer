# -*- coding: utf-8 -*-
"""LeetCodeTrainer Python 执行模板（EmbeddedResource，运行时由 C# 解出）。

用法: python harness.py solution.py cases.json
 - solution.py: 用户代码
 - cases.json:  [{"index": 0, "input": "nums=[2,7], target=9", "expected_output": "[0,1]"}]
协议边界: stdout 最后一行输出 '###RESULTS###' + JSON。
results 元素: {index, actual, stdout, stderr, elapsed_ms, error}
"""
import ast
import contextlib
import inspect
import io
import json
import sys
import time
import traceback

RESULTS_MARKER = '###RESULTS###'


def split_top_level(text, sep=','):
    """按括号/引号感知方式切分顶层 sep。"""
    parts, buf, depth = [], [], 0
    in_str, quote, escaped = False, '', False
    for ch in text:
        if in_str:
            buf.append(ch)
            if escaped:
                escaped = False
            elif ch == '\\':
                escaped = True
            elif ch == quote:
                in_str = False
            continue
        if ch in ('"', "'"):
            in_str, quote = True, ch
            buf.append(ch)
            continue
        if ch in '[{(':
            depth += 1
        elif ch in ']})':
            depth = max(0, depth - 1)
        if ch == sep and depth == 0:
            parts.append(''.join(buf))
            buf = []
        else:
            buf.append(ch)
    if buf or parts:
        parts.append(''.join(buf))
    return parts


def find_top_level_equals(text):
    """找第一个顶层（括号外/引号外/非比较运算）的 '='。"""
    depth = 0
    in_str, quote, escaped = False, '', False
    for i, ch in enumerate(text):
        if in_str:
            if escaped:
                escaped = False
            elif ch == '\\':
                escaped = True
            elif ch == quote:
                in_str = False
            continue
        if ch in ('"', "'"):
            in_str, quote = True, ch
            continue
        if ch in '[{(':
            depth += 1
        elif ch in ']})':
            depth = max(0, depth - 1)
        elif ch == '=' and depth == 0:
            if i > 0 and text[i - 1] in '!<>=':
                continue
            if i + 1 < len(text) and text[i + 1] == '=':
                continue
            return i
    return -1


def parse_value(text):
    """true/false/null 归一后优先 ast.literal_eval，失败再 json.loads，最后退化为原字符串。"""
    text = text.strip()
    lowered = text.lower()
    if lowered == 'true':
        return True
    if lowered == 'false':
        return False
    if lowered in ('null', 'none'):
        return None
    try:
        return ast.literal_eval(text)
    except Exception:
        pass
    try:
        return json.loads(text)
    except Exception:
        pass
    return text


def parse_input(input_line):
    """'nums=[2,7], target=9' -> (names, values)。"""
    names, values = [], {}
    for part in split_top_level(input_line):
        part = part.strip()
        if not part:
            continue
        eq = find_top_level_equals(part)
        if eq <= 0:
            raise ValueError('无法解析参数片段: %r' % part)
        name = part[:eq].strip()
        names.append(name)
        values[name] = parse_value(part[eq + 1:])
    return names, values


def jsonable(value):
    """返回值转 JSON 可表达结构：tuple/set -> list，dict 键转 str，其他退化 repr。"""
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    if isinstance(value, (tuple, list)):
        return [jsonable(v) for v in value]
    if isinstance(value, (set, frozenset)):
        return [jsonable(v) for v in list(value)]
    if isinstance(value, dict):
        return {str(k): jsonable(v) for k, v in value.items()}
    try:
        json.dumps(value)
        return value
    except Exception:
        return repr(value)


def pick_solution_method(sol, param_names):
    """优先形参名集合与输入 key 集合一致的方法；找不到则取第一个公开方法。"""
    methods = []
    for klass in type(sol).__mro__:
        for name, attr in list(vars(klass).items()):
            if name.startswith('_') or not callable(attr):
                continue
            try:
                sig = inspect.signature(attr)
            except (TypeError, ValueError):
                continue
            params = [p.name for p in sig.parameters.values()
                      if p.kind in (inspect.Parameter.POSITIONAL_ONLY,
                                    inspect.Parameter.POSITIONAL_OR_KEYWORD)]
            methods.append((name, params))
    target = set(param_names)
    for name, params in methods:
        if target and set(params) == target:
            return name, params
    return (methods[0] if methods else (None, []))


def run_single_case(sol, case):
    """执行单用例：捕获打印、计时、捕获异常堆栈。"""
    out = {'index': case.get('index', 0), 'actual': None, 'stdout': '',
           'stderr': '', 'elapsed_ms': 0.0, 'error': ''}
    try:
        names, values = parse_input(case.get('input', ''))
    except Exception:
        out['error'] = traceback.format_exc()
        return out

    name, params = pick_solution_method(sol, names)
    if name is None:
        out['error'] = 'Solution 中没有可调用的公开方法'
        return out

    func = getattr(sol, name)
    buf = io.StringIO()
    start = time.perf_counter()
    result = None
    try:
        with contextlib.redirect_stdout(buf):
            try:
                if names and set(names) == set(params):
                    result = func(**{p: values[p] for p in params})
                else:
                    result = func(*[values[k] for k in names][:len(params)])
            except Exception:
                out['error'] = traceback.format_exc()
    finally:
        out['elapsed_ms'] = round((time.perf_counter() - start) * 1000.0, 3)
        out['stdout'] = buf.getvalue()

    if not out['error']:
        try:
            out['actual'] = jsonable(result)
        except Exception:
            out['actual'] = repr(result)
    return out


def main():
    if len(sys.argv) < 3:
        sys.stderr.write('usage: harness.py solution.py cases.json\n')
        return 2
    solution_path, cases_path = sys.argv[1], sys.argv[2]

    with open(solution_path, 'r', encoding='utf-8') as f:
        code = f.read()
    with open(cases_path, 'r', encoding='utf-8') as f:
        cases = json.load(f)

    results = []
    namespace = {'__name__': '__leetcode_solution__'}
    try:
        exec(compile(code, 'solution.py', 'exec'), namespace)
        exec_error = ''
    except Exception:
        exec_error = traceback.format_exc()

    if exec_error:
        # 用户代码编译/执行阶段失败：全部用例标记失败并携带完整堆栈
        for case in cases:
            results.append({'index': case.get('index', 0), 'actual': None,
                            'stdout': '', 'stderr': '', 'elapsed_ms': 0.0,
                            'error': exec_error})
    else:
        solution = None
        try:
            solution = namespace['Solution']()
        except Exception:
            exec_error = traceback.format_exc()

        if solution is None:
            for case in cases:
                results.append({'index': case.get('index', 0), 'actual': None,
                                'stdout': '', 'stderr': '', 'elapsed_ms': 0.0,
                                'error': exec_error or '未找到 Solution 类'})
        else:
            for case in cases:
                results.append(run_single_case(solution, case))

    sys.stdout.write(RESULTS_MARKER + json.dumps(results, ensure_ascii=False))
    sys.stdout.write('\n')
    try:
        sys.stdout.flush()
    except Exception:
        pass
    return 0


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass
    sys.exit(main())
