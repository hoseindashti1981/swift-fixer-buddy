import { expect, test } from "bun:test";
import { diagnosticGuides, guideNodes, GUIDE_REVISION } from "../src/data/diagnostic-guides";
import {
  classReadings,
  guideReference,
  guideReport,
  parseGuideState,
  validateGuides,
  walkGuide,
} from "../src/lib/diagnostics";

const guide = (id: string) => diagnosticGuides.find((item) => item.id === id)!;

test("every guide terminates and every operational reference is published and sourced", () => {
  expect(validateGuides()).toEqual({ guides: 6, branches: 85 });
  for (const item of diagnosticGuides) {
    const nodes = guideNodes(item);
    function visit(id: string, answers: string[]) {
      const node = nodes[id]!;
      const walked = walkGuide(item, answers);
      expect(walked.valid).toBe(true);
      expect(walked.nodeId).toBe(id);
      for (const ref of node.refs) expect(guideReference(ref)?.sources.length).toBeGreaterThan(0);
      if (node.kind === "question")
        for (const choice of node.choices) visit(choice.next, [...answers, choice.id]);
      else expect(guideReport(item, answers, {}).body).toContain(node.title);
    }
    visit("safety", []);
  }
  expect(guideReference("local-test")).toBeNull();
});

test("class scenarios link the observation and report to the matching passages", () => {
  for (const [id, path, anchor] of [
    ["pressure-drop", "clear,gradual,dry", "ahi-pressure-drop#summer"],
    ["pressure-drop", "clear,cycle", "ahi-pressure-drop#cycle"],
    ["pressure-drop", "clear,fill", "ahi-p02#p02"],
    ["heating", "clear,yes,one", "ahi-cold-radiators#local"],
    ["heating", "clear,yes,last", "ahi-cold-radiators#local"],
    ["heating", "clear,yes,all,both", "ahi-d08#d08"],
    ["hot-water", "clear,local", "ahi-methods#m12"],
    ["hot-water", "clear,initial", "ahi-d16#d16"],
    ["hot-water", "clear,steady", "ahi-d15#d15"],
  ] as const) {
    const answers = path.split(",");
    const { nodeId } = walkGuide(guide(id), answers);
    expect(classReadings(id, nodeId).map((ref) => ref.id + "#" + ref.anchor)).toContain(anchor);
    expect(guideReport(guide(id), answers, {}).body).toContain("/note/" + anchor);
    expect(classReadings(id, "stop-gas")).toEqual([]);
  }
  expect(parseGuideState({ guide: "heating", v: 2, answers: "clear,yes,all,no" }).reset).toBe(true);
  expect(parseGuideState({ guide: "noise", v: 2, answers: "clear,knock,tap" }).reset).toBe(false);
});

test("danger always terminates before technical questions; uncertainty never becomes a diagnosis", () => {
  for (const item of diagnosticGuides) {
    for (const answer of ["gas", "co", "flue", "heat", "unknown"]) {
      const { node } = walkGuide(item, [answer]);
      expect(node.kind === "result" && node.status).toBe("stop");
      expect(walkGuide(item, [answer, "clear"]).valid).toBe(false);
    }
    const { node } = walkGuide(item, ["clear", "unknown"]);
    expect(node.kind === "result" && node.status).toBe("unknown");
  }
  expect(walkGuide(guide("flue"), ["clear", "yes"]).nodeId).toBe("integrity");
  expect(walkGuide(guide("flue"), ["clear", "no", "bypass"]).nodeId).toBe("bypass");
});

test("model-dependent diverter result requires a confirmed architecture; code never identifies a part", () => {
  const water = guide("hot-water");
  expect(walkGuide(water, ["clear", "heating", "yes"]).nodeId).toBe("diverter");
  expect(walkGuide(water, ["clear", "heating", "no"]).nodeId).toBe("need-evidence");
  expect(walkGuide(water, ["clear", "heating", "unknown"]).nodeId).toBe("need-evidence");
  expect(walkGuide(guide("ignition"), ["clear", "code"]).node).toMatchObject({
    kind: "result",
    status: "unknown",
  });
});

test("route validates answers from the safety gate and resets malformed or outdated histories", () => {
  const valid = {
    guide: "noise",
    v: GUIDE_REVISION,
    answers: "clear,knock,tap",
    q: "تقه",
    model: "L24FF",
    limit: 50,
  };
  expect(parseGuideState(valid)).toEqual({ ...valid, reset: false });
  expect(parseGuideState({ ...valid, v: Number(GUIDE_REVISION) }).answers).toBe(valid.answers);
  expect(parseGuideState({ ...valid, v: "1" }).reset).toBe(true);
  for (const answers of [
    "knock,tap",
    "clear,bogus",
    "clear,kettle,tap",
    "__proto__",
    ["clear"],
    "x".repeat(501),
  ]) {
    expect(parseGuideState({ ...valid, answers })).toEqual({
      guide: "noise",
      v: GUIDE_REVISION,
      answers: "",
      reset: true,
      q: "تقه",
      model: "L24FF",
      limit: 50,
    });
    const merged = { ...valid, answers, ...parseGuideState({ ...valid, answers }) };
    expect(parseGuideState(merged).answers).toBe("");
  }
  expect(parseGuideState({ ...valid, v: "0" }).answers).toBe("");
  expect(parseGuideState({ ...valid, guide: "missing" }).guide).toBe("");
  expect(parseGuideState({ ...valid, guide: "missing" }).reset).toBe(true);
  // Re-answering an earlier question removes all downstream assumptions.
  expect(walkGuide(guide("noise"), ["clear"]).nodeId).toBe("start");
  expect(walkGuide(guide("noise"), ["clear", "gurgle"]).nodeId).toBe("air");
});

test("saved report retains observations, scope, result and source locators without verified provenance", () => {
  const report = guideReport(guide("noise"), ["clear", "knock", "tap"], {
    brand: "بوتان",
    model: "test",
  });
  expect(report.category).toBe("بررسی‌های من");
  expect(report.provenance).toBeUndefined();
  expect(report.content).toBeUndefined();
  expect(report.body).toContain("بوتان / test");
  expect(report.body).toContain("باز یا بسته‌شدن شیر آب");
  expect(report.body).toContain("ضربه قوچ قابل بررسی است");
  expect(report.body).toContain("تأیید نشده");
  expect(report.body).toContain("https://www.vaillant.co.uk/");
  expect(() => guideReport(guide("noise"), ["clear"], {})).toThrow();
  expect(() => guideReport(guide("noise"), ["clear", "kettle", "bad"], {})).toThrow();
});
