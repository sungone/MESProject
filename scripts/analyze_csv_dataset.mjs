/** Stream CSV files and report schema and basic quality statistics as JSON. */

import { createReadStream, promises as fs } from "node:fs";
import { createInterface } from "node:readline";
import { basename } from "node:path";

const missingTokens = new Set(["", "na", "n/a", "nan", "null", "none"]);

function parseCsvLine(line) {
  const values = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      values.push(value);
      value = "";
    } else {
      value += character;
    }
  }
  values.push(value);
  return values;
}

function newColumnStats() {
  return {
    missing: 0,
    numeric: 0,
    min: null,
    max: null,
    lexicalMin: null,
    lexicalMax: null,
    examples: [],
    valueCounts: new Map(),
    uniqueOverflow: false,
  };
}

async function analyze(path) {
  const fileStats = await fs.stat(path);
  const trackDuplicates = fileStats.size <= 50 * 1024 * 1024;
  const input = createReadStream(path, { encoding: "utf8" });
  const lines = createInterface({ input, crlfDelay: Infinity });
  let header = null;
  let stats = null;
  let rows = 0;
  let malformedRows = 0;
  const featureGroups = trackDuplicates ? new Map() : null;

  for await (const line of lines) {
    if (header === null) {
      header = parseCsvLine(line.replace(/^\uFEFF/, ""));
      stats = header.map(newColumnStats);
      continue;
    }

    rows += 1;
    let row = parseCsvLine(line);
    if (row.length !== header.length) {
      malformedRows += 1;
      row = row.slice(0, header.length);
      while (row.length < header.length) row.push("");
    }

    row.forEach((rawValue, index) => {
      const value = rawValue.trim();
      const stat = stats[index];
      if (missingTokens.has(value.toLowerCase())) {
        stat.missing += 1;
        return;
      }
      if (stat.examples.length < 5 && !stat.examples.includes(value)) {
        stat.examples.push(value);
      }
      stat.lexicalMin = stat.lexicalMin === null || value < stat.lexicalMin ? value : stat.lexicalMin;
      stat.lexicalMax = stat.lexicalMax === null || value > stat.lexicalMax ? value : stat.lexicalMax;
      const number = Number(value);
      if (Number.isFinite(number)) {
        stat.numeric += 1;
        stat.min = stat.min === null ? number : Math.min(stat.min, number);
        stat.max = stat.max === null ? number : Math.max(stat.max, number);
      }
      if (!stat.uniqueOverflow) {
        stat.valueCounts.set(value, (stat.valueCounts.get(value) ?? 0) + 1);
        if (stat.valueCounts.size > 500) {
          stat.valueCounts.clear();
          stat.uniqueOverflow = true;
        }
      }
    });

    if (featureGroups) {
      const featureValues = row.filter((_, index) => header[index] !== "" && header[index] !== "PassOrFail");
      const featureKey = featureValues.join("\u001f");
      const labelIndex = header.indexOf("PassOrFail");
      const group = featureGroups.get(featureKey) ?? { count: 0, labels: new Set() };
      group.count += 1;
      if (labelIndex >= 0) group.labels.add(row[labelIndex]);
      featureGroups.set(featureKey, group);
    }
  }

  let duplicateFeatureRows = null;
  let duplicateFeatureGroups = null;
  let conflictingLabelGroups = null;
  if (featureGroups) {
    duplicateFeatureRows = 0;
    duplicateFeatureGroups = 0;
    conflictingLabelGroups = 0;
    for (const group of featureGroups.values()) {
      if (group.count > 1) {
        duplicateFeatureGroups += 1;
        duplicateFeatureRows += group.count - 1;
      }
      if (group.labels.size > 1) conflictingLabelGroups += 1;
    }
  }
  return {
    file: basename(path),
    path,
    bytes: fileStats.size,
    encoding: "utf-8",
    delimiter: ",",
    rows,
    columns: header?.length ?? 0,
    malformedRows,
    duplicateFeatureRows,
    duplicateFeatureGroups,
    conflictingLabelGroups,
    schema: (header ?? []).map((name, index) => {
      const stat = stats[index];
      const present = rows - stat.missing;
      const sortedCounts = stat.uniqueOverflow
        ? null
        : Object.fromEntries([...stat.valueCounts.entries()].sort((a, b) => b[1] - a[1]));
      return {
        name,
        missing: stat.missing,
        missingPct: rows ? Number(((stat.missing / rows) * 100).toFixed(4)) : 0,
        inferredType: present > 0 && stat.numeric === present ? "numeric" : "text",
        min: stat.min,
        max: stat.max,
        lexicalMin: stat.lexicalMin,
        lexicalMax: stat.lexicalMax,
        examples: stat.examples,
        valueCounts: sortedCounts,
      };
    }),
  };
}

const args = process.argv.slice(2);
const outputIndex = args.indexOf("--output");
let outputPath = null;
if (outputIndex >= 0) {
  outputPath = args[outputIndex + 1];
  args.splice(outputIndex, 2);
}

const report = [];
for (const path of args) report.push(await analyze(path));
const payload = `${JSON.stringify(report, null, 2)}\n`;
if (outputPath) await fs.writeFile(outputPath, payload, "utf8");
else process.stdout.write(payload);
