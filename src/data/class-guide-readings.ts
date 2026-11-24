// Each destination names a stable section in the imported class references.
type ClassGuide = { id: string; title: string; topic: string; readings: Record<string, string[]> };

export const classGuides: ClassGuide[] = [
  {
    id: "pressure-drop",
    title: "افت فشار پکیج",
    topic: "ahi-pressure-drop",
    readings: {
      start: ["ahi-methods#m01", "ahi-p03#p03"],
      gradual: ["ahi-pressure-drop#slow", "ahi-p01#p01"],
      visible: ["ahi-pressure-drop#slow", "ahi-d10#d10"],
      dry: ["ahi-pressure-drop#summer", "ahi-expansion-vessel#valve", "ahi-pressure-drop#slow"],
      cycle: [
        "ahi-pressure-drop#cycle",
        "ahi-expansion-vessel#symptoms",
        "ahi-p12#p12",
        "ahi-p05#p05",
      ],
      fill: ["ahi-pressure-drop#fill", "ahi-p02#p02", "ahi-p03#p03"],
      vented: ["ahi-pressure-drop#slow", "ahi-p01#p01"],
    },
  },
  {
    id: "heating",
    title: "رادیاتور سرد است",
    topic: "ahi-cold-radiators",
    readings: {
      start: ["ahi-cold-radiators#whole"],
      controls: ["ahi-cold-radiators#whole"],
      pattern: ["ahi-cold-radiators#local", "ahi-cold-radiators#whole"],
      air: ["ahi-cold-radiators#local", "ahi-p24#p24"],
      last: ["ahi-cold-radiators#local", "ahi-p13#p13", "ahi-expansion-vessel#symptoms"],
      one: ["ahi-cold-radiators#d46", "ahi-cold-radiators#local", "ahi-p24#p24"],
      water: ["ahi-cold-radiators#whole", "ahi-methods#m08"],
      "demand-display": ["ahi-cold-radiators#whole", "ahi-methods#m08", "ahi-p08#p08"],
      distribution: ["ahi-cold-radiators#d17", "ahi-p14#p14", "ahi-p08#p08"],
      both: ["ahi-d08#d08", "ahi-p04#p04"],
    },
  },
  {
    id: "hot-water",
    title: "آب مصرفی ولرم است",
    topic: "ahi-d15",
    readings: {
      start: ["ahi-d15#d15", "ahi-methods#m12"],
      flow: ["ahi-d21#d21", "ahi-methods#m13"],
      local: ["ahi-d15#d15", "ahi-methods#m12", "ahi-d19#d19"],
      initial: ["ahi-d16#d16", "ahi-p07#p07"],
      steady: ["ahi-d15#d15", "ahi-d21#d21", "ahi-p15#p15"],
      architecture: ["ahi-d12#d12", "ahi-p14#p14"],
      diverter: ["ahi-d14#d14", "ahi-d12#d12", "ahi-p14#p14"],
      demand: ["ahi-methods#m08", "ahi-d11#d11", "ahi-p09#p09"],
      code: ["ahi-methods#m08"],
    },
  },
];
