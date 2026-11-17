"""Testes do filtro: saída segura e repositórios Git exclusivamente temporários."""

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "review_inputs.py"
PRIVATE = "NARRATIVA_NAO_DEVE_ENTRAR_NO_CONTEXTO"


class ReviewInputsTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.git("init", "-b", "main")
        self.git("config", "user.name", "Fixture")
        self.git("config", "user.email", "fixture@example.invalid")
        self.registro = self.root / "docs/03-execucao/registro.md"
        self.setup_layout(self.registro)
        self.write("src/login.py", "BEFORE\n")
        self.git("add", "--", ".")
        self.git("commit", "-m", "baseline temporario")

    def git(self, *args):
        result = subprocess.run(["git", "-C", str(self.root), *args],
                                capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        return result.stdout

    def write(self, relative, content):
        path = self.root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        return path

    def setup_layout(self, registro):
        registro.parent.mkdir(parents=True, exist_ok=True)
        registro.write_text(
            "|Task|Marco|Status|Commit|Atualizado em|Observações|\n"
            "| :--- | ---: | :----: | --- | --- | --- |\n"
            "| M01-T03 | M01 | aguardando revisão | - | 2026-09-30T14:20:00-03:00 | "
            + PRIVATE + " |\n", encoding="utf-8")
        self.findings = registro.parent / "achados"
        self.findings.mkdir(parents=True, exist_ok=True)

    def run_script(self, task="M01-T03", *extra):
        return subprocess.run([sys.executable, str(SCRIPT), str(self.registro), task, *extra],
                              capture_output=True, text=True)

    def assert_safe(self, result):
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertNotIn(PRIVATE, result.stdout + result.stderr)
        return json.loads(result.stdout)

    def test_untracked_reports_are_filtered_but_code_tests_and_docs_remain_visible(self):
        self.write("src/login.py", "STAGED_CODE\n")
        self.git("add", "--", "src/login.py")
        self.write("src/login.py", "WORKTREE_CODE\n")
        self.write("tests/login.py", "NEW_TEST_CODE\n")
        self.write("docs/reference/autenticacao.md", "DOC_DELIVERABLE\n")
        (self.findings / "task-M01-T03-relatorio.md").write_text(PRIVATE, encoding="utf-8")
        before_status = self.git("status", "--porcelain")
        before_index = self.git("ls-files", "--stage")
        before_files = {path.relative_to(self.root): path.read_bytes()
                        for path in self.root.rglob("*") if path.is_file() and ".git" not in path.parts}
        output = self.assert_safe(self.run_script())
        self.assertIn("WORKTREE_CODE", output["diffs"]["HEAD"])
        self.assertIn("STAGED_CODE", output["diffs"]["staged"])
        self.assertIn("WORKTREE_CODE", output["diffs"]["unstaged"])
        self.assertEqual(output["untracked_allowed"],
                         ["docs/reference/autenticacao.md", "tests/login.py"])
        self.assertIn("docs/03-execucao/achados/task-M01-T03-relatorio.md", output["deferred_changed"])
        self.assertEqual(self.git("status", "--porcelain"), before_status)
        self.assertEqual(self.git("ls-files", "--stage"), before_index)
        after_files = {path.relative_to(self.root): path.read_bytes()
                       for path in self.root.rglob("*") if path.is_file() and ".git" not in path.parts}
        self.assertEqual(after_files, before_files)

    def test_tracked_staged_and_unstaged_narratives_and_record_are_filtered(self):
        report = self.findings / "task-M01-T03-relatorio.md"
        report.write_text(PRIVATE + " BEFORE", encoding="utf-8")
        self.git("add", "--", str(report))
        self.git("commit", "-m", "relato temporario")
        report.write_text(PRIVATE + " STAGED", encoding="utf-8")
        self.git("add", "--", str(report))
        report.write_text(PRIVATE + " UNSTAGED", encoding="utf-8")
        self.registro.write_text(self.registro.read_text(encoding="utf-8").replace(PRIVATE, PRIVATE + " EDIT"),
                                 encoding="utf-8")
        self.write("src/login.py", "DELIVERED_CODE\n")
        review = self.findings / "task-M01-T03-revisao-1.md"
        review.write_text("Estado: finalizada\n" + PRIVATE, encoding="utf-8")
        (self.findings / "task-M01-T03-revisao-2.md").write_text(
            "Estado: incompleta\n" + PRIVATE, encoding="utf-8")
        output = self.assert_safe(self.run_script())
        self.assertIn("DELIVERED_CODE", output["diffs"]["HEAD"])
        self.assertEqual([(entry["round"], entry["state"]) for entry in output["reviews"]],
                         [(1, "finalizada"), (2, "incompleta")])
        for diff in output["diffs"].values():
            self.assertNotIn("Observações", diff)
            self.assertNotIn("relatorio.md", diff)
            self.assertNotIn("revisao-", diff)

    def test_metadata_only_changes_produce_empty_diffs_not_an_unfiltered_fallback(self):
        (self.findings / "task-M01-T03-relatorio.md").write_text(PRIVATE, encoding="utf-8")
        output = self.assert_safe(self.run_script())
        self.assertTrue(all(not diff for diff in output["diffs"].values()))
        self.assertEqual(output["untracked_allowed"], [])

    def test_recolhe_layout_is_discovered_from_the_supplied_record(self):
        self.registro = self.root / "docs_sistema_recolhe/execucao/registro.md"
        self.setup_layout(self.registro)
        (self.findings / "task-M01-T03-relatorio.md").write_text(PRIVATE, encoding="utf-8")
        self.write("docs_sistema_recolhe/reference/manual.md", "MANUAL\n")
        output = self.assert_safe(self.run_script())
        self.assertEqual(output["achados"], "docs_sistema_recolhe/execucao/achados")
        self.assertIn("docs_sistema_recolhe/reference/manual.md", output["untracked_allowed"])
        # O registro do outro layout não é metadado deste fluxo: não excluir docs/ inteira.
        self.assertNotIn("docs/03-execucao/registro.md", output["deferred_changed"])

    def test_unknown_artifact_in_findings_stops_without_emitting_content(self):
        (self.findings / "manual-entregavel.md").write_text(PRIVATE, encoding="utf-8")
        result = self.run_script()
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "")
        self.assertNotIn(PRIVATE, result.stderr)
        self.assertIn("não reconhecido", result.stderr)

    def test_rename_across_narrative_boundary_stops_before_content(self):
        report = self.findings / "task-M01-T03-relatorio.md"
        report.write_text(PRIVATE, encoding="utf-8")
        self.git("add", "--", str(report))
        self.git("commit", "-m", "relato temporario")
        (self.root / "docs/reference").mkdir(parents=True)
        self.git("mv", "--", str(report), "docs/reference/manual.md")
        result = self.run_script()
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "")
        self.assertNotIn(PRIVATE, result.stderr)
        self.assertIn("cruza", result.stderr)

    def test_symbolic_alias_to_narrative_is_not_allowed_for_reading(self):
        report = self.findings / "task-M01-T03-relatorio.md"
        report.write_text(PRIVATE, encoding="utf-8")
        try:
            (self.root / "manual.md").symlink_to(report)
        except OSError:
            self.skipTest("ambiente sem permissão para criar symlinks")
        result = self.run_script()
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "")
        self.assertNotIn(PRIVATE, result.stderr)

    def test_invalid_record_or_task_does_not_emit_observations(self):
        for task in ("M99-T99", "../M01-T03"):
            with self.subTest(task=task):
                result = self.run_script(task)
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual(result.stdout, "")
                self.assertNotIn(PRIVATE, result.stderr)

    def test_legacy_review_is_identified_without_emitting_its_conclusion(self):
        (self.findings / "task-M01-T03-revisao-1.md").write_text(PRIVATE, encoding="utf-8")
        output = self.assert_safe(self.run_script())
        self.assertEqual(output["reviews"][0]["state"], "não identificado")

    def test_snapshot_tracks_untracked_content_but_not_narrative_edits(self):
        code = self.write("tests/new.py", "FIRST_CODE\n")
        report = self.findings / "task-M01-T03-relatorio.md"
        report.write_text(PRIVATE, encoding="utf-8")
        first = self.assert_safe(self.run_script())["snapshot"]
        report.write_text(PRIVATE + " EDIT", encoding="utf-8")
        self.assertEqual(self.assert_safe(self.run_script())["snapshot"], first)
        code.write_text("SECOND_CODE\n", encoding="utf-8")
        self.assertNotEqual(self.assert_safe(self.run_script())["snapshot"], first)

    def test_new_task_id_does_not_inherit_four_reviews_from_replaced_task(self):
        old_files = []
        for number in range(1, 5):
            path = self.findings / f"task-M01-T03-revisao-{number}.md"
            path.write_text("Estado: finalizada\n" + PRIVATE, encoding="utf-8")
            old_files.append(path)
        record = self.registro.read_text(encoding="utf-8").replace(
            "aguardando revisão", "substituída"
        )
        record += "| M01-T07 | M01 | não iniciada | - | 2026-10-02T09:00:00-03:00 | origem: M01-T03 |\n"
        self.registro.write_text(record, encoding="utf-8")
        output = self.assert_safe(self.run_script("M01-T07"))
        self.assertEqual(output["reviews"], [])
        self.assertTrue(all(path.read_text(encoding="utf-8").endswith(PRIVATE) for path in old_files))
        review = self.findings / "task-M01-T07-revisao-1.md"
        review.write_text("Estado: incompleta\n" + PRIVATE, encoding="utf-8")
        output = self.assert_safe(self.run_script("M01-T07"))
        self.assertEqual([(entry["round"], entry["state"]) for entry in output["reviews"]],
                         [(1, "incompleta")])

    def test_integration_metadata_is_emitted_without_other_observations(self):
        integration = "b" * 40
        content = self.registro.read_text(encoding="utf-8").replace(
            "aguardando revisão | - |", "concluída | a1b2c3d |"
        ).replace(PRIVATE, PRIVATE + "; Integração: " + integration)
        self.registro.write_text(content, encoding="utf-8")
        output = self.assert_safe(self.run_script())
        self.assertEqual(output["integration"], integration)
        self.assertEqual(output["commit"], "a1b2c3d")
        self.assertEqual(output["registro_tasks"][0]["integration"], integration)

    def test_duplicate_review_state_markers_stop_without_emitting_narrative(self):
        review = self.findings / "task-M01-T03-revisao-1.md"
        review.write_text("Estado: incompleta\n" + PRIVATE + "\nEstado: finalizada\n",
                          encoding="utf-8")
        result = self.run_script()
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "")
        self.assertNotIn(PRIVATE, result.stderr)

    def source_fixture(self):
        task = ("## M01-T03 — Avaliar\n\n### Fazer\nAvaliar.\n"
                "### Não alterar\nNão corrigir.\n### Entregáveis\nParecer.\n"
                "### Critério de conclusão\nVerificar.\n"
                "### Protocolo\nPersistir antes do confronto.\n")
        self.write("docs/plano.md", "# Plano\n\n## Restrições comuns\nRESTRICAO\n\n"
                   + task + "## Histórico preservado\n" + PRIVATE + "\n")
        self.write("docs/estrategia.md", "# Estratégia\nMATRIZ\n"
                   "#### Aceitação explícita\nDECISAO_VIGENTE\n"
                   "##### Complemento factual\n" + PRIVATE + "\n"
                   "## Aceitação com usuários\nREQUISITO\n")
        self.write("docs/fluxo.md", "# Fluxo\nNode 24\n"
                   "```powershell\n## Resultado do ensaio\n```\n"
                   "PREPARAR_SQLITE_ANTES_DE_COMPOSER\n<!-- fim-operacao -->\n"
                   "## Resultado do ensaio\n" + PRIVATE + "\n"
                   "## Encerramento\nENCERRAR_PROCESSOS\n")
        def partition(boundaries, phases):
            return [{"selector": {"start": start, "end_before": end}, "phase": phase}
                    for start, end, phase in zip([None] + boundaries, boundaries + [None], phases)]
        self.source_config = {
            "version": 1, "tasks": {"M01-T03": {
                "task": {"path": "docs/plano.md", "selector": {"heading": "## M01-T03 — Avaliar"}},
                "common": [{"path": "docs/plano.md", "selector": {"heading": "## Restrições comuns"}}],
                "sources": [
                    {"path": "docs/plano.md", "sections": partition(
                        ["## Histórico preservado"], ["initial", "deferred"])},
                    {"path": "docs/estrategia.md", "sections": partition(
                        ["##### Complemento factual", "## Aceitação com usuários"],
                        ["initial", "deferred", "initial"])},
                    {"path": "docs/fluxo.md", "sections": [
                        {"selector": {"start": None, "end_before": "<!-- fim-operacao -->"},
                         "phase": "initial"},
                        {"selector": {"start": "<!-- fim-operacao -->", "end_before": "## Encerramento"},
                         "phase": "deferred"},
                        {"selector": {"heading": "## Encerramento"}, "phase": "initial"}]}
                ]}}}
        return task

    def save_config(self):
        self.write("config/fontes.json", json.dumps(self.source_config, ensure_ascii=False))

    def run_sources(self, *extra):
        self.save_config()
        return self.run_script("M01-T03", "--sources", str(self.root / "config/fontes.json"), *extra)

    def test_mixed_sources_emit_full_task_common_and_only_classified_norms(self):
        task = self.source_fixture()
        output = self.assert_safe(self.run_sources())
        self.assertEqual(output["task_input"]["content"], task)
        self.assertIn("RESTRICAO", output["common_input"][0]["content"])
        contents = "".join(item["content"] for item in output["normative_input"])
        for expected in ("MATRIZ", "DECISAO_VIGENTE", "REQUISITO",
                         "PREPARAR_SQLITE_ANTES_DE_COMPOSER", "ENCERRAR_PROCESSOS"):
            self.assertIn(expected, contents)
        self.assertEqual(len(output["deferred_sections"]), 3)
        self.assertEqual(len(output["source_manifest"]), 3)
        self.assertEqual(len(output["git_revision"]), 40)
        self.assertEqual(len(output["input_id"]), 64)

    def test_mixed_sources_never_leak_staged_unstaged_or_deleted_narrative_hunks(self):
        self.source_fixture()
        self.save_config()
        self.git("add", ".")
        self.git("commit", "-m", "fontes temporarias")
        path = self.root / "docs/plano.md"
        path.write_text(path.read_text(encoding="utf-8").replace(PRIVATE, PRIVATE + " STAGED"), encoding="utf-8")
        self.git("add", ".")
        path.write_text(path.read_text(encoding="utf-8").replace("STAGED", "UNSTAGED"), encoding="utf-8")
        output = self.assert_safe(self.run_sources())
        self.assertIn("docs/plano.md", output["deferred_changed"])
        self.assertTrue(all(not diff for diff in output["diffs"].values()))
        self.assertNotIn("docs/plano.md", output["untracked_allowed"])
        # Nada é apagado: a revisão final consulta o caminho e seus diffs.
        self.assertIn(PRIVATE, self.git("diff", "HEAD", "--", "docs/plano.md"))

    def test_missing_duplicate_ambiguous_overlapping_or_incomplete_selection_fails_closed(self):
        import copy
        self.source_fixture()
        baseline = copy.deepcopy(self.source_config)
        mutations = [
            lambda spec: spec["task"]["selector"].update(heading="## Ausente"),
            lambda spec: spec["sources"][0]["sections"][0]["selector"].update(end_before="Ausente"),
            lambda spec: spec["sources"].append(copy.deepcopy(spec["sources"][0])),
            lambda spec: spec["sources"][0]["sections"].append(copy.deepcopy(spec["sources"][0]["sections"][0])),
            lambda spec: spec["sources"][0]["sections"].pop(),
            lambda spec: spec["sources"][0].update(sections=[]),
            lambda spec: spec["common"].append(copy.deepcopy(spec["common"][0])),
            lambda spec: spec["task"]["selector"].update(extra="invalido"),
            lambda spec: spec["sources"][0]["sections"][0].update(phase="talvez"),
            lambda spec: spec["sources"][0]["sections"][0].update(phase="deferred"),
            lambda spec: spec["sources"][0].update(path="../plano.md"),
            lambda spec: spec["sources"][0].update(path="docs/inexistente.md"),
            lambda spec: spec["task"].update(selector={"start": "## M01-T03 — Avaliar", "end_before": "### Protocolo"}),
            lambda spec: spec["sources"][0]["sections"][0].update(phase=[]),
            lambda spec: spec["task"].update(path=[]),
        ]
        for mutate in mutations:
            with self.subTest(mutation=mutate):
                self.source_config = copy.deepcopy(baseline)
                mutate(self.source_config["tasks"]["M01-T03"])
                result = self.run_sources()
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual(result.stdout, "")
                self.assertNotIn(PRIVATE, result.stderr)

    def test_duplicate_heading_or_marker_is_not_resolved_by_first_match(self):
        self.source_fixture()
        path = self.root / "docs/plano.md"
        original = path.read_text(encoding="utf-8")
        for duplicate in ("## M01-T03 — Avaliar", "## Histórico preservado"):
            path.write_text(original + "\n" + duplicate + "\n", encoding="utf-8")
            result = self.run_sources()
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(result.stdout, "")
            self.assertNotIn(PRIVATE, result.stderr)

    def test_headings_in_fences_are_not_ambiguous_and_task_subsections_are_complete(self):
        self.source_fixture()
        path = self.root / "docs/plano.md"
        path.write_text("~~~markdown\n## M01-T03 — Avaliar\n~~~\n" + path.read_text(encoding="utf-8"), encoding="utf-8")
        output = self.assert_safe(self.run_sources())
        self.assertIn("### Protocolo", output["task_input"]["content"])

    def test_sources_require_registered_task_complete_fields_and_unique_json_keys(self):
        self.source_fixture()
        path = self.root / "docs/plano.md"
        path.write_text(path.read_text(encoding="utf-8").replace("### Fazer", "### Outro"), encoding="utf-8")
        self.assertNotEqual(self.run_sources().returncode, 0)
        self.save_config()
        config = self.root / "config/fontes.json"
        config.write_text(config.read_text(encoding="utf-8").replace('"version": 1', '"version": 1, "version": 1'), encoding="utf-8")
        result = self.run_script("M01-T03", "--sources", str(config))
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "")
        result = self.run_script("M01-T03", "--sources", str(self.root / "ausente.json"))
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "")

    def test_actuality_checks_all_source_bytes_even_deferred_and_new_git_revision(self):
        self.source_fixture()
        first = self.assert_safe(self.run_sources())
        # Persistir fora do repo: um JSON de entrada não é entregável nem deve
        # tornar-se arquivo untracked que muda o próprio snapshot.
        with tempfile.TemporaryDirectory() as directory:
            previous = Path(directory) / "input.json"
            previous.write_text(json.dumps(first), encoding="utf-8")
            self.assert_safe(self.run_sources("--check-input", str(previous)))
            path = self.root / "docs/plano.md"
            original = path.read_text(encoding="utf-8")
            path.write_text(original.replace(PRIVATE, PRIVATE + " EDIT"), encoding="utf-8")
            second = self.assert_safe(self.run_sources())
            self.assertNotEqual(first["input_id"], second["input_id"])
            self.assertNotEqual(first["snapshot"], second["snapshot"])
            self.assertNotEqual(first["source_manifest"][0]["sha256"], second["source_manifest"][0]["sha256"])
            result = self.run_sources("--check-input", str(previous))
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(result.stdout, "")
            path.write_text(original, encoding="utf-8")
            self.assert_safe(self.run_sources("--check-input", str(previous)))
            self.git("commit", "--allow-empty", "-m", "nova revisao git")
            third = self.assert_safe(self.run_sources())
            self.assertNotEqual(first["git_revision"], third["git_revision"])
            self.assertNotEqual(self.run_sources("--check-input", str(previous)).returncode, 0)

    def test_staging_a_source_with_identical_worktree_changes_identity_without_leaking_hunks(self):
        self.source_fixture()
        self.save_config()
        self.git("add", ".")
        self.git("commit", "-m", "fontes temporarias")
        path = self.root / "docs/plano.md"
        path.write_text(path.read_text(encoding="utf-8").replace(PRIVATE, PRIVATE + " EDIT"), encoding="utf-8")
        first = self.assert_safe(self.run_sources())
        self.git("add", "--", "docs/plano.md")
        second = self.assert_safe(self.run_sources())
        self.assertEqual(first["source_manifest"], second["source_manifest"])
        self.assertNotEqual(first["source_diff_hashes"], second["source_diff_hashes"])
        self.assertNotEqual(first["input_id"], second["input_id"])
        self.assertNotEqual(first["snapshot"], second["snapshot"])

    def test_preparing_selected_sources_does_not_modify_worktree_or_index(self):
        self.source_fixture()
        self.save_config()
        before = self.git("status", "--porcelain"), self.git("ls-files", "--stage")
        files = {path.relative_to(self.root): path.read_bytes() for path in self.root.rglob("*")
                 if path.is_file() and ".git" not in path.parts}
        self.assert_safe(self.run_script("M01-T03", "--sources", str(self.root / "config/fontes.json")))
        self.assertEqual(before, (self.git("status", "--porcelain"), self.git("ls-files", "--stage")))
        self.assertEqual(files, {path.relative_to(self.root): path.read_bytes() for path in self.root.rglob("*")
                                 if path.is_file() and ".git" not in path.parts})

    def test_configuration_change_invalidates_input(self):
        self.source_fixture()
        first = self.assert_safe(self.run_sources())
        self.source_config["tasks"]["M01-T03"]["sources"][1]["sections"][1]["phase"] = "initial"
        # Alterar a seleção é detectável; validá-la contra as fontes continua
        # responsabilidade humana, não decisão semântica do preparador.
        self.save_config()
        second = json.loads(self.run_script("M01-T03", "--sources", str(self.root / "config/fontes.json")).stdout)
        self.assertNotEqual(first["input_id"], second["input_id"])
        self.assertNotEqual(first["config"]["sha256"], second["config"]["sha256"])

    def test_source_cannot_be_record_or_report(self):
        self.source_fixture()
        report = self.findings / "task-M01-T03-relatorio.md"
        report.write_text(PRIVATE, encoding="utf-8")
        for path in (self.registro, report):
            self.source_config["tasks"]["M01-T03"]["sources"][0]["path"] = path.relative_to(self.root).as_posix()
            result = self.run_sources()
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(result.stdout, "")
            self.assertNotIn(PRIVATE, result.stderr)

    def assert_closed(self, result):
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "")
        self.assertNotIn(PRIVATE, result.stderr)

    def test_case_alias_of_mixed_source_fails_before_emitting_narrative_diffs(self):
        self.source_fixture()
        self.save_config()
        self.git("add", ".")
        self.git("commit", "-m", "fontes temporarias")
        path = self.root / "docs/estrategia.md"
        path.write_text(path.read_text(encoding="utf-8").replace(PRIVATE, PRIVATE + " STAGED"), encoding="utf-8")
        self.git("add", ".")
        path.write_text(path.read_text(encoding="utf-8").replace("STAGED", "UNSTAGED"), encoding="utf-8")
        # No Windows ambos os caminhos existem e são o mesmo arquivo; não
        # depende de symlink. Em FS sensível, o alias ausente também é erro.
        self.source_config["tasks"]["M01-T03"]["sources"][1]["path"] = "DOCS/estrategia.md"
        self.assert_closed(self.run_sources())

    def test_case_alias_of_record_or_report_is_not_a_normative_source(self):
        self.source_fixture()
        report = self.findings / "task-M01-T03-relatorio.md"
        report.write_text(PRIVATE, encoding="utf-8")
        sources = self.source_config["tasks"]["M01-T03"]["sources"]
        for path in (self.registro, report):
            with self.subTest(path=path.name):
                sources.append({"path": path.relative_to(self.root).as_posix().upper(),
                                "sections": [{"selector": {"start": None, "end_before": None},
                                              "phase": "initial"}]})
                self.assert_closed(self.run_sources())
                sources.pop()

    def test_duplicate_source_by_case_alias_is_rejected(self):
        self.source_fixture()
        sources = self.source_config["tasks"]["M01-T03"]["sources"]
        sources.append({"path": "docs/ESTRATEGIA.md", "sections": sources[1]["sections"]})
        self.assert_closed(self.run_sources())

    def test_case_alias_of_configuration_is_rejected(self):
        self.source_fixture()
        self.save_config()
        self.assert_closed(self.run_script("M01-T03", "--sources", str(self.root / "CONFIG/FONTES.JSON")))

    @unittest.skipUnless(sys.platform == "win32", "identidade Path case-insensitive do Windows")
    def test_git_case_differing_from_actual_source_fails_before_emitting_diffs(self):
        self.source_fixture()
        self.save_config()
        self.git("add", ".")
        self.git("commit", "-m", "fontes temporarias")
        old = self.root / "docs/estrategia.md"
        interim = old.with_name("intermediario.md")
        old.rename(interim)
        renamed = old.with_name("ESTRATEGIA.md")
        interim.rename(renamed)
        renamed.write_text(renamed.read_text(encoding="utf-8").replace(PRIVATE, PRIVATE + " EDIT"), encoding="utf-8")
        self.source_config["tasks"]["M01-T03"]["sources"][1]["path"] = "docs/ESTRATEGIA.md"
        result = self.run_sources()
        self.assert_closed(result)
        self.assertIn("caminho Git difere", result.stderr)

    def test_distinct_case_sensitive_sources_are_not_collapsed(self):
        self.source_fixture()
        if (self.root / "docs/ESTRATEGIA.md").exists():
            self.skipTest("filesystem não distingue arquivos por caixa")
        self.git("config", "core.ignorecase", "false")
        self.write("docs/ESTRATEGIA.md", "REQUISITO_DISTINTO\n")
        self.source_config["tasks"]["M01-T03"]["sources"].append({
            "path": "docs/ESTRATEGIA.md", "sections": [
                {"selector": {"start": None, "end_before": None}, "phase": "initial"}]})
        output = self.assert_safe(self.run_sources())
        paths = [item["path"] for item in output["source_manifest"]]
        self.assertIn("docs/estrategia.md", paths)
        self.assertIn("docs/ESTRATEGIA.md", paths)
        self.assertIn("REQUISITO_DISTINTO", "".join(item["content"] for item in output["normative_input"]))

    def test_task_without_config_selection_cannot_fall_back_to_entire_plan(self):
        self.source_fixture()
        self.source_config["tasks"] = {}
        result = self.run_sources()
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "")
        self.assertNotIn(PRIVATE, result.stderr)

    def test_project_configuration_preserves_t39_coverage_without_known_historical_conclusions(self):
        project = SCRIPT.parents[4]
        config_path = project / ".agents/review-sources.json"
        if not config_path.exists():
            self.skipTest("configuração específica do Recolhe ausente neste clone da skill")
        config = json.loads(config_path.read_text(encoding="utf-8"))
        spec = config["tasks"]["M01-T39"]
        for source in spec["sources"]:
            self.write(source["path"], (project / source["path"]).read_text(encoding="utf-8"))
        self.registro.write_text(self.registro.read_text(encoding="utf-8").replace("M01-T03", "M01-T39"), encoding="utf-8")
        self.write("fontes.json", json.dumps(config, ensure_ascii=False))
        output = self.assert_safe(self.run_script("M01-T39", "--sources", str(self.root / "fontes.json")))
        content = "\n".join(item["content"] for item in output["normative_input"])
        # Seletores/manifesto também entram no contexto: não transportar as
        # frases históricas por esses metadados ao filtrar só o conteúdo.
        source_input = json.dumps({key: output[key] for key in (
            "task_input", "common_input", "normative_input", "source_manifest", "deferred_sections")},
            ensure_ascii=False)
        for excluded in ("A execução inicial de M01-T31 comprovou", "No ensaio T34,",
                         "Na v5 funcionaram", "Simple Bluetooth Printer funcionou",
                         "com comunicação validada em protótipos", "### Ponto de partida e limites de uso",
                         "Não foi identificado, na investigação,", "Acentos e raster falharam",
                         "A v5 já tenta conversão explícita", "seu insucesso",
                         "foi reutilizada nos ensaios", "validado no protótipo", "3 s nos ensaios"):
            self.assertNotIn(excluded, content)
        for excluded in ("A v5 já tenta conversão explícita", "seu insucesso",
                         "foi reutilizada nos ensaios", "validado no protótipo", "3 s nos ensaios"):
            self.assertNotIn(excluded, source_input)
        for required in ("### Protocolo de leitura e incidentes da avaliação independente",
                         "Restrições comuns de M01-T33–T40", "T-DEPS-01", "T-GATE-01",
                         "T-PRINT-01", "T-PRINT-08", "T-PRINT-M08", "T-REV-01",
                         "Build/watch sobre código", "Aceitação explícita do risco remanescente",
                         "não se usa mais a aceitação anterior para adiar essa correção.",
                         "composer install --no-interaction --prefer-dist", "php artisan down",
                         "php artisan up", "24.22.2", "ca1bff5d8ead13c9f2ea404a176db46bd430704d5b5113734049fa365e7799e2"):
            self.assertIn(required, content)
        thermal = "".join(item["content"] for item in output["normative_input"]
                          if item["path"] == "docs_sistema_recolhe/reference/impressao-termica.md")
        for required in ("aceita a emissão térmica sem acentos", "transliteração controlada",
                         "Caracteres não cobertos precisam de tratamento explícito",
                         "Imagens raster/logotipos", "fora do escopo", "usar o comando nativo ESC/POS",
                         "e homologar os dois conteúdos reais.", "`TextEncoder` gera UTF-8, não CP860.",
                         "QR Pix, chave e link de contato devem manter o conteúdo configurado **exato**",
                         "não transliterar payloads de QR, URLs ou identificadores",
                         "Limitação de codificação de um conteúdo configurado exige tratamento/teste explícito",
                         "`requestPort()` diretamente em gesto do usuário", "Não abrir seletor automaticamente",
                         "`getPorts()` consulta autorizações do navegador/origem, não tokens da aplicação",
                         "pode ser revogada e precisa ser refeita ao trocar de origem/perfil",
                         "Não escolher arbitrariamente a primeira porta", "**a cada trabalho**",
                         "Trava de operação e botão desabilitado", "proteção contra repetição",
                         "identificador efêmero de operação/OS", "não criar contador/histórico de impressão",
                         "### Estados e recuperação", "Sem porta autorizada ou permissão revogada",
                         "Cancelamento/`NotFoundError`", "Falha ao abrir/`NetworkError`",
                         "Erro durante escrita, aba fechada/atualizada", "Falha ao fechar",
                         "A impressão não salva novamente nem altera pagamento/container"):
            self.assertIn(required, thermal)
        self.assertIn("### Protocolo", output["task_input"]["content"])
        self.assertEqual(len(output["source_manifest"]), len(spec["sources"]))


if __name__ == "__main__":
    unittest.main()
