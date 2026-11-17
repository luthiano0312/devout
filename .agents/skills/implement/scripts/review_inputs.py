#!/usr/bin/env python3
"""Prepara entradas da primeira fase da revisão, sem modificar o repositório.

Uso: python review_inputs.py <registro.md> <task-id> [--sources fontes.json]

Com --sources, seleciona task, restrições e fontes classificadas pelo projeto.
--check-input entrada.json recusa uma entrada cuja identidade não seja atual.
Seletores usam títulos Markdown ou marcadores literais únicos, nunca linhas.

JSON na saída: metadados mínimos, inventário, diffs filtrados e arquivos novos
permitidos para leitura. Relatos e Observações nunca são emitidos. Os estados
incompleta/finalizada das revisões são metadados, não suas conclusões.
Não atribui mudanças à task, não faz revisão e não autoriza commits.
"""

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
from pathlib import Path

# Importar o validador compartilhado não deve criar __pycache__ na skill.
sys.dont_write_bytecode = True
from update_registro import FULL_HASH, HEADER_CELLS, INTEGRATION_MARKER, cells, find_task

NARRATIVE = re.compile(r"task-.+-(?:relatorio|revisao-[1-9][0-9]*)\.md")
REVIEW_STATE = re.compile(r"^Estado: (incompleta|finalizada)$", re.MULTILINE)


def git(root, *args):
    result = subprocess.run(
        ["git", "--no-pager", "-C", str(root), *args],
        capture_output=True, env={**os.environ, "GIT_OPTIONAL_LOCKS": "0"},
    )
    if result.returncode:
        # Não ecoar stderr arbitrário de comandos/configurações no contexto.
        raise ValueError(f"comando Git falhou: {args[0]}")
    return result.stdout


def name_changes(raw):
    fields = raw.decode("utf-8", errors="surrogateescape").split("\0")
    i = 0
    while i < len(fields) and fields[i]:
        status = fields[i]
        count = 2 if status.startswith(("R", "C")) else 1
        paths = fields[i + 1:i + 1 + count]
        if len(paths) != count or not all(paths):
            raise ValueError("inventário Git incompleto")
        yield status, paths
        i += count + 1


def metadata(row):
    if row[3] != "-" and not re.fullmatch(r"[0-9a-fA-F]{7,40}", row[3]):
        raise ValueError("hash funcional malformado no registro")
    links = [part.strip() for part in row[5].split(";") if "Integração:" in part]
    integration = None
    if links:
        if (len(links) != 1 or not links[0].startswith(INTEGRATION_MARKER)
                or not FULL_HASH.fullmatch(links[0][len(INTEGRATION_MARKER):])):
            raise ValueError("vínculo de integração malformado no registro")
        integration = links[0][len(INTEGRATION_MARKER):].lower()
    return {"task": row[0], "marco": row[1], "status": row[2],
            "commit": row[3], "updated_at": row[4], "integration": integration}


def source_path(root, value):
    if not isinstance(value, str) or not value or "\\" in value:
        raise ValueError("caminho de fonte inválido")
    relative = Path(value)
    if relative.is_absolute() or ".." in relative.parts:
        raise ValueError("fonte fora da raiz")
    path = root / relative
    if not path.is_file() or path.resolve() != path.absolute():
        raise ValueError("fonte ausente ou caminho simbólico")
    # Path.__eq__ ignora caixa no Windows. Exigir a grafia real de cada
    # componente rejeita aliases antes das reservas/partições, sem confundir
    # arquivos distintos em filesystems sensíveis a caixa.
    parent = root
    for part in relative.parts:
        if part not in {child.name for child in parent.iterdir()}:
            raise ValueError("caixa do caminho de fonte difere do arquivo")
        parent /= part
    return path


def select_span(text, selector):
    """Intervalos em caracteres; fences não transformam exemplos em títulos."""
    if not isinstance(selector, dict):
        raise ValueError("seletor inválido")
    if set(selector) == {"heading"}:
        wanted = selector["heading"]
        if not isinstance(wanted, str) or not re.match(r"^#{1,6} ", wanted):
            raise ValueError("título inválido")
        headings = []
        fence = None
        offset = 0
        for line in text.splitlines(keepends=True):
            clean = line.rstrip("\r\n")
            marker = re.match(r"^ {0,3}(`{3,}|~{3,})(.*)$", clean)
            if marker:
                token = marker[1]
                if fence is None:
                    fence = token
                elif token[0] == fence[0] and len(token) >= len(fence) and not marker[2].strip():
                    fence = None
            elif fence is None:
                match = re.match(r"^(#{1,6}) (.+)$", clean)
                if match:
                    headings.append((offset, len(match[1]), clean))
            offset += len(line)
        matches = [i for i, item in enumerate(headings) if item[2] == wanted]
        if len(matches) != 1:
            raise ValueError("título ausente, duplicado ou ambíguo")
        index = matches[0]
        start, level, _ = headings[index]
        end = next((pos for pos, depth, _ in headings[index + 1:] if depth <= level), len(text))
        return start, end
    if set(selector) != {"start", "end_before"}:
        raise ValueError("seletor ausente ou desconhecido")

    def boundary(marker, default):
        if marker is None:
            return default
        if not isinstance(marker, str) or not marker or text.count(marker) != 1:
            raise ValueError("marcador ausente, duplicado ou ambíguo")
        return text.index(marker)

    start = boundary(selector["start"], 0)
    end = boundary(selector["end_before"], len(text))
    if end <= start:
        raise ValueError("seleção vazia ou invertida")
    return start, end


def load_sources(root, config_path, task_id, forbidden):
    """Valida tudo antes de devolver conteúdo; nenhuma alternativa de arquivo inteiro."""
    config_path = config_path.absolute()
    try:
        config_name = config_path.relative_to(root).as_posix()
    except ValueError as exc:
        raise ValueError("configuração fora da raiz") from exc
    config_path = source_path(root, config_name)

    def unique_keys(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError("chave duplicada na configuração")
            result[key] = value
        return result

    config_raw = config_path.read_bytes()
    config = json.loads(config_raw, object_pairs_hook=unique_keys)
    if (not isinstance(config, dict) or set(config) != {"version", "tasks"}
            or config["version"] != 1 or not isinstance(config["tasks"], dict)):
        raise ValueError("formato de configuração inválido")
    spec = config["tasks"].get(task_id)
    if (not isinstance(spec, dict) or set(spec) != {"task", "common", "sources"}
            or not isinstance(spec["common"], list) or not spec["common"]
            or not isinstance(spec["sources"], list) or not spec["sources"]):
        raise ValueError("task sem seleção de fontes completa")
    documents = {}
    manifest = []
    deferred = []
    contents = []
    raw_files = {config_name: config_raw}
    for entry in spec["sources"]:
        if not isinstance(entry, dict) or set(entry) != {"path", "sections"}:
            raise ValueError("fonte sem classificação explícita")
        name = entry["path"]
        path = source_path(root, name)
        name = path.relative_to(root).as_posix()
        if name in documents or forbidden(name) != "entregavel" or name == config_name:
            raise ValueError("fonte duplicada ou reservada a metadados")
        raw = path.read_bytes()
        raw_files[name] = raw
        text = raw.decode("utf-8").replace("\r\n", "\n")
        if not isinstance(entry["sections"], list) or not entry["sections"]:
            raise ValueError("fonte sem seleções")
        spans = []
        for section in entry["sections"]:
            if (not isinstance(section, dict) or set(section) != {"selector", "phase"}
                    or section["phase"] not in {"initial", "deferred"}):
                raise ValueError("classificação inválida")
            start, end = select_span(text, section["selector"])
            spans.append((start, end, section))
        spans.sort(key=lambda span: span[0])
        cursor = 0
        allowed = []
        for start, end, section in spans:
            if start != cursor:
                raise ValueError("seleções sobrepostas, duplicadas ou conteúdo sem classificação")
            cursor = end
            info = {"path": name, "selector": section["selector"]}
            if section["phase"] == "initial":
                allowed.append((start, end))
                contents.append({**info, "content": text[start:end]})
            else:
                deferred.append(info)
        if cursor != len(text):
            raise ValueError("conteúdo final sem classificação")
        documents[name] = (text, allowed)
        manifest.append({"path": name, "sha256": hashlib.sha256(raw).hexdigest(),
                         "sections": entry["sections"]})

    def required(selection):
        if not isinstance(selection, dict) or set(selection) != {"path", "selector"}:
            raise ValueError("seleção obrigatória inválida")
        name = selection["path"]
        if name not in documents:
            raise ValueError("seleção obrigatória sem fonte classificada")
        text, allowed = documents[name]
        start, end = select_span(text, selection["selector"])
        if not any(left <= start and end <= right for left, right in allowed):
            raise ValueError("task/restrição não está integralmente permitida")
        return {**selection, "content": text[start:end]}

    task = required(spec["task"])
    if set(task["selector"]) != {"heading"}:
        raise ValueError("task exige título completo, não intervalo parcial")
    if not re.match(r"^#{1,6} " + re.escape(task_id) + r"(?:\s|$)", task["content"]):
        raise ValueError("seleção da task não corresponde ao ID")
    for field in ("Fazer", "Não alterar", "Entregáveis", "Critério de conclusão"):
        if not re.search(r"^#{1,6} " + field + r"\s*$", task["content"], re.MULTILINE):
            raise ValueError("task incompleta")
    common = [required(selection) for selection in spec["common"]]
    if len({(item["path"], json.dumps(item["selector"], sort_keys=True)) for item in common}) != len(common):
        raise ValueError("restrição duplicada")
    return ({"config": {"path": config_name, "sha256": hashlib.sha256(config_raw).hexdigest()},
             "task_input": task, "common_input": common, "normative_input": contents,
             "source_manifest": manifest, "deferred_sections": deferred}, raw_files)


def prepare(registro, task_id, sources=None):
    if (not task_id or task_id in {".", ".."}
            or any(char in task_id for char in "/\\\0\r\n")):
        raise ValueError("ID incompatível com os nomes dos arquivos de execução")
    registro = registro.absolute()
    if not registro.is_file() or registro.is_symlink():
        raise ValueError("registro ausente ou caminho simbólico; esclareça o mapa")
    root = Path(os.fsdecode(git(registro.parent, "rev-parse", "--show-toplevel")).strip()).resolve()
    initial_head = git(root, "rev-parse", "HEAD").decode("ascii").strip()
    try:
        registro = registro.resolve()
        register_path = registro.relative_to(root).as_posix()
    except ValueError as exc:
        raise ValueError("registro fora da raiz do repositório") from exc
    findings = registro.parent / "achados"
    if findings.resolve() != findings or (findings.exists() and not findings.is_dir()):
        raise ValueError("pasta de achados ambígua; esclareça o mapa")
    findings_path = findings.relative_to(root)
    lines = registro.read_text(encoding="utf-8").splitlines()
    _, row = find_task(lines, task_id)
    register_tasks = []
    in_table = False
    for line in lines:
        if not in_table:
            try:
                in_table = cells(line) == HEADER_CELLS
            except ValueError:
                pass
            continue
        if not line.lstrip().startswith("|"):
            break
        values = cells(line)
        if all(re.fullmatch(r":?-{3,}:?", value) for value in values):
            continue
        register_tasks.append(metadata(values))

    def category(path):
        relative = Path(path)
        if relative.is_absolute() or ".." in relative.parts:
            raise ValueError("caminho Git fora da raiz")
        if relative == Path(register_path):
            return "registro"
        if findings_path in relative.parents:
            if relative.parent == findings_path and NARRATIVE.fullmatch(relative.name):
                return "narrativa"
            raise ValueError(f"arquivo não reconhecido na área de achados: {path}")
        return "entregavel"

    source_input, raw_sources = ({}, {})
    if sources is not None:
        source_input, raw_sources = load_sources(root, sources, task_id, category)
    mixed_paths = {Path(path) for path in raw_sources}
    base_category = category

    def category(path):
        kind = base_category(path)
        if kind == "entregavel" and Path(path) in mixed_paths:
            if path not in raw_sources:
                raise ValueError("caixa do caminho Git difere da fonte selecionada")
            return "fonte selecionada"
        return kind

    changes = {}

    def remember(path, source, status):
        kind = category(path)
        changes.setdefault(path, {"path": path, "kind": kind, "changes": []})
        changes[path]["changes"].append({"source": source, "status": status})
        return kind

    modes = [("HEAD", ["HEAD"]), ("staged", ["--cached"]), ("unstaged", [])]
    for source, arguments in modes:
        raw = git(root, "diff", "--no-ext-diff", "--no-textconv",
                  "--name-status", "-z", "--find-renames", *arguments, "--")
        for status, paths in name_changes(raw):
            kinds = [remember(path, source, status) for path in paths]
            if len(set(kinds)) > 1:
                raise ValueError("renomeação/cópia cruza entregáveis e metadados; esclareça antes da leitura")
    untracked = [os.fsdecode(path) for path in
                 git(root, "ls-files", "--others", "--exclude-standard", "-z").split(b"\0") if path]
    for path in untracked:
        remember(path, "untracked", "?")

    allowed = sorted(path for path, entry in changes.items() if entry["kind"] == "entregavel")
    deferred = sorted(path for path, entry in changes.items() if entry["kind"] != "entregavel")
    for path in allowed:
        target = (root / path).resolve()
        try:
            target_path = target.relative_to(root).as_posix()
        except ValueError as exc:
            raise ValueError(f"entregável aponta para fora da raiz: {path}") from exc
        if category(target_path) != "entregavel":
            raise ValueError(f"entregável aponta para metadados: {path}")

    # Exclusões adicionais impedem que um pathspec de arquivo removido, hoje
    # ancestral de uma pasta, inclua os metadados dessa pasta por prefixo.
    pathspecs = ([f":(top,literal){path}" for path in allowed]
                 + [f":(top,literal,exclude){path}" for path in deferred])
    diffs = {}
    for source, arguments in modes:
        diffs[source] = (git(root, "diff", "--no-ext-diff", "--no-textconv",
                            "--no-color", "--find-renames", *arguments, "--", *pathspecs)
                         .decode("utf-8", errors="replace") if allowed else "")

    # Ler estes arquivos internamente serve somente para extrair o marcador
    # de estado. Nunca devolver sua narrativa ou decisão ao agente nesta fase.
    reviews = []
    review_name = re.compile(r"task-" + re.escape(task_id) + r"-revisao-([1-9][0-9]*)\.md")
    if findings.exists():
        for path in findings.iterdir():
            match = review_name.fullmatch(path.name)
            if not match:
                continue
            if path.is_symlink() or not path.is_file():
                raise ValueError("revisão com caminho ambíguo")
            states = REVIEW_STATE.findall(path.read_text(encoding="utf-8"))
            if len(states) > 1:
                raise ValueError("revisão com marcadores de estado duplicados")
            reviews.append({"round": int(match[1]), "path": path.relative_to(root).as_posix(),
                            "state": states[0] if states else "não identificado"})

    working = [(path, hashlib.sha256((root / path).read_bytes()).hexdigest()
                if (root / path).is_file() else None) for path in allowed]
    if mixed_paths:
        # As versões anteriores/staged podem conter narrativas: identificar suas
        # mudanças por hash, sem emitir hunks antes do confronto obrigatório.
        specs = [f":(top,literal){path}" for path in sorted(raw_sources)]
        source_input["source_diff_hashes"] = {
            source: hashlib.sha256(git(root, "diff", "--no-ext-diff", "--no-textconv",
                                       "--no-color", *arguments, "--", *specs)).hexdigest()
            for source, arguments in modes
        }
    fingerprint = {"head": initial_head,
                   "inventory": [changes[path] for path in allowed],
                   "diffs": diffs, "working": working, "sources": source_input}
    snapshot = hashlib.sha256(json.dumps(fingerprint, ensure_ascii=True, sort_keys=True)
                              .encode("utf-8")).hexdigest()

    head = fingerprint["head"]
    identity = {"head": head, "snapshot": snapshot, "sources": source_input,
                "task": task_id, "registro": register_path,
                "metadata": metadata(row), "registro_tasks": register_tasks}
    input_id = hashlib.sha256(json.dumps(identity, ensure_ascii=True, sort_keys=True)
                              .encode("utf-8")).hexdigest()
    # Não publicar uma entrada se fontes/configuração/HEAD mudaram na preparação.
    if (any((root / path).read_bytes() != raw for path, raw in raw_sources.items())
            or git(root, "rev-parse", "HEAD").decode("ascii").strip() != head):
        raise ValueError("fontes mudaram durante a preparação; execute novamente")
    return {
        "input_id": input_id, "git_revision": head, **source_input,
        "snapshot": snapshot,
        **metadata(row), "registro_tasks": register_tasks,
        "registro": register_path, "achados": findings_path.as_posix(),
        "relatorio": (findings_path / f"task-{task_id}-relatorio.md").as_posix(),
        "inventory": [changes[path] for path in sorted(changes)],
        "diffs": diffs,
        "untracked_allowed": sorted(path for path in untracked if category(path) == "entregavel"),
        "deferred_changed": deferred,
        "reviews": sorted(reviews, key=lambda review: review["round"]),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("registro", type=Path)
    parser.add_argument("task")
    parser.add_argument("--sources", type=Path, help="configuração versionada do projeto")
    parser.add_argument("--check-input", type=Path, help="recusa entrada persistida desatualizada")
    args = parser.parse_args()
    try:
        result = prepare(args.registro, args.task, args.sources)
        if args.check_input:
            previous = json.loads(args.check_input.read_bytes())
            if not isinstance(previous, dict) or previous.get("input_id") != result["input_id"]:
                raise ValueError("entrada desatualizada; prepare e avalie novamente")
    except TypeError:
        parser.exit(2, "Erro: tipo inválido na configuração ou entrada persistida\n")
    except (ValueError, OSError, UnicodeError) as exc:
        parser.exit(2, f"Erro: {exc}\n")
    # ASCII escapado funciona também em consoles Windows sem UTF-8.
    print(json.dumps(result, ensure_ascii=True, indent=2))


if __name__ == "__main__":
    main()
