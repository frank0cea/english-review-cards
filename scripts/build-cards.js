const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..", "..");
const sourcePath = path.join(rootDir, "前四题和雨课堂全部_中英对照.md");
const outputPath = path.resolve(__dirname, "..", "data", "cards.json");

function tidy(value = "") {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\s+$/g, "")
    .trim();
}

function compactLine(value = "") {
  return tidy(value.replace(/ {2,}$/g, ""));
}

function between(text, start, end) {
  const startIndex = text.indexOf(start);
  const endIndex = text.indexOf(end, startIndex + start.length);
  if (startIndex === -1 || endIndex === -1) {
    throw new Error(`Cannot find section between "${start}" and "${end}".`);
  }
  return text.slice(startIndex + start.length, endIndex);
}

function after(text, start) {
  const startIndex = text.indexOf(start);
  if (startIndex === -1) {
    throw new Error(`Cannot find section after "${start}".`);
  }
  return text.slice(startIndex + start.length);
}

function splitByHeading(text, regex) {
  const matches = Array.from(text.matchAll(regex));
  return matches.map((match, index) => {
    const bodyStart = match.index + match[0].length;
    const bodyEnd = matches[index + 1] ? matches[index + 1].index : text.length;
    return { match, body: text.slice(bodyStart, bodyEnd) };
  });
}

function parseEntries(block) {
  const entries = [];
  let current = null;

  for (const rawLine of block.split("\n")) {
    const line = compactLine(rawLine);
    if (!line) continue;

    const labeled = line.match(/^\*\*(.+?)：\*\*\s*(.*)$/);
    if (labeled) {
      current = {
        label: labeled[1].trim(),
        value: compactLine(labeled[2]),
      };
      entries.push(current);
      continue;
    }

    if (current) {
      current.value = compactLine(`${current.value} ${line}`);
    }
  }

  return entries;
}

function findEntry(entries, labelPrefix) {
  const index = entries.findIndex((entry) => entry.label.startsWith(labelPrefix));
  if (index === -1) {
    throw new Error(`Missing field "${labelPrefix}".`);
  }

  const zh = entries[index + 1]?.label === "中文" ? entries[index + 1].value : "";
  return { value: entries[index].value, zh, index };
}

function parseRewriteCards(markdown) {
  const area = between(
    markdown,
    "## 第一部分：课后题 Unit 1 Exercise 1-3（组合句子）",
    "## 第二部分：课后题 Unit 1 Exercise 4（句子改错）",
  );

  const cards = [];
  const exerciseSections = splitByHeading(area, /^### Exercise\s+(\d+)\s*$/gm);

  for (const exercise of exerciseSections) {
    const exerciseNumber = Number(exercise.match[1]);
    const questionBlocks = splitByHeading(exercise.body, /^####\s+(\d+)\.\s*$/gm);

    for (const block of questionBlocks) {
      const number = Number(block.match[1]);
      const entries = parseEntries(block.body);
      const original = findEntry(entries, "Original / 原句");
      const rewrite = findEntry(entries, "Rewrite / 改写");
      const alternatives = entries
        .filter((entry) => entry.label.startsWith("Alternative / 另一种改法"))
        .map((entry) => {
          const index = entries.indexOf(entry);
          return {
            en: entry.value,
            zh: entries[index + 1]?.label === "中文" ? entries[index + 1].value : "",
          };
        });

      cards.push({
        id: `ex${exerciseNumber}-q${number}`,
        type: "rewrite",
        source: "课后题",
        section: `Exercise ${exerciseNumber}`,
        number,
        title: `Exercise ${exerciseNumber}.${number}`,
        promptKind: "组合句子",
        original: { en: original.value, zh: original.zh },
        answer: { en: rewrite.value, zh: rewrite.zh },
        alternatives,
        tags: ["课后题", "组合句子", `Exercise ${exerciseNumber}`],
      });
    }
  }

  return cards;
}

function parseCorrectionCards(markdown) {
  const area = between(
    markdown,
    "## 第二部分：课后题 Unit 1 Exercise 4（句子改错）",
    "## 第二部分：雨课堂全部题目（1-6，30题）",
  );

  return splitByHeading(area, /^###\s+(\d+)\.\s*$/gm).map((block) => {
    const number = Number(block.match[1]);
    const entries = parseEntries(block.body);
    const original = findEntry(entries, "Original / 原句");
    const correction = findEntry(entries, "Correction / 改正");

    return {
      id: `ex4-q${number}`,
      type: "correction",
      source: "课后题",
      section: "Exercise 4",
      number,
      title: `Exercise 4.${number}`,
      promptKind: "判断正误",
      original: { en: original.value, zh: original.zh },
      answer: { en: correction.value, zh: correction.zh },
      tags: ["课后题", "判断正误", "Exercise 4"],
    };
  });
}

function parseQuizBlock(body) {
  const card = {
    questionZh: "",
    context: null,
    answer: "",
    options: [],
  };

  let currentOption = null;
  let collectingContext = false;
  let contextEn = "";

  for (const rawLine of body.split("\n")) {
    const line = compactLine(rawLine);
    if (!line) continue;

    const answer = line.match(/^\*\*答案：([A-D])\*\*$/);
    if (answer) {
      card.answer = answer[1];
      currentOption = null;
      collectingContext = false;
      continue;
    }

    const paragraph = line.match(/^\*\*Paragraph \/ 段落：\*\*\s*(.*)$/);
    if (paragraph) {
      collectingContext = true;
      currentOption = null;
      contextEn = compactLine(paragraph[1]);
      continue;
    }

    const option = line.match(/^- \*\*([A-D])\.\*\*\s*(.*)$/);
    if (option) {
      collectingContext = false;
      currentOption = {
        label: option[1],
        text: compactLine(option[2]),
        zh: "",
      };
      card.options.push(currentOption);
      continue;
    }

    const chinese = line.match(/^\*\*中文：\*\*\s*(.*)$/);
    if (chinese) {
      const value = compactLine(chinese[1]);
      if (currentOption) {
        currentOption.zh = value;
        continue;
      }
      if (collectingContext || contextEn) {
        card.context = { en: compactLine(contextEn), zh: value };
        collectingContext = false;
        continue;
      }
      if (!card.questionZh) {
        card.questionZh = value;
      }
      continue;
    }

    if (collectingContext) {
      contextEn = compactLine(`${contextEn} ${line}`);
    } else if (currentOption) {
      currentOption.text = compactLine(`${currentOption.text} ${line}`);
    }
  }

  return card;
}

function parseQuizCards(markdown) {
  const area = after(markdown, "## 第二部分：雨课堂全部题目（1-6，30题）");
  const cards = [];
  const quizSections = splitByHeading(area, /^## 雨课堂(\d+)：(.+)$/gm);

  for (const section of quizSections) {
    const setNumber = Number(section.match[1]);
    const setTitle = compactLine(section.match[2]);
    const questionBlocks = splitByHeading(section.body, /^###\s+(\d+)\.\s*(.+)$/gm);

    for (const block of questionBlocks) {
      const number = Number(block.match[1]);
      const parsed = parseQuizBlock(block.body);

      if (!parsed.answer || parsed.options.length < 2) {
        throw new Error(`Invalid quiz card: 雨课堂${setNumber}.${number}`);
      }

      cards.push({
        id: `yt${setNumber}-q${number}`,
        type: "quiz",
        source: "雨课堂",
        section: `雨课堂${setNumber}`,
        setTitle,
        number,
        title: `雨课堂${setNumber}.${number}`,
        promptKind: "选项判断",
        question: compactLine(block.match[2]),
        questionZh: parsed.questionZh,
        context: parsed.context,
        answer: parsed.answer,
        options: parsed.options,
        tags: ["雨课堂", "选项判断", `雨课堂${setNumber}`],
      });
    }
  }

  return cards;
}

function main() {
  const markdown = fs.readFileSync(sourcePath, "utf8").replace(/\r\n/g, "\n");
  const cards = [
    ...parseRewriteCards(markdown),
    ...parseCorrectionCards(markdown),
    ...parseQuizCards(markdown),
  ];

  const summary = cards.reduce(
    (acc, card) => {
      acc.total += 1;
      acc[card.type] += 1;
      return acc;
    },
    { total: 0, rewrite: 0, correction: 0, quiz: 0 },
  );

  const expected = { total: 63, rewrite: 23, correction: 10, quiz: 30 };
  for (const [key, value] of Object.entries(expected)) {
    if (summary[key] !== value) {
      throw new Error(`Expected ${key}=${value}, got ${summary[key]}.`);
    }
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    sourceFile: path.basename(sourcePath),
    summary,
    cards,
  };

  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(
    `Generated ${summary.total} cards: ${summary.rewrite} rewrite, ${summary.correction} correction, ${summary.quiz} quiz.`,
  );
}

main();
