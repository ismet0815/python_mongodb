// Lesson/scene definitions for the MQL Academy tutorial.
//
// Each lesson is one "chapter": a short cinematic narration, followed by a
// timed challenge. `correctAnswer` is used both to grade the student's
// answer (by comparing result sets, not exact query text) and to drive the
// "show me" replay animation when time runs out.
//
// find-mode answers use the envelope { filter, sort?, projection?, limit? }.
// aggregate-mode answers are a pipeline array, exactly like a real Mongo
// aggregate() call.

export const lessons = [
  {
    id: "meet-the-data",
    chapter: 1,
    title: "Meet Your Data",
    collection: "cars",
    mode: "find",
    timeLimitSeconds: 120,
    narration: [
      "Every MongoDB collection is just a pile of JSON-like documents.",
      "No tables, no fixed columns — every car in this collection is one document, with fields like Marke, Price, PS and Fuel_Type.",
      "The simplest possible query is an empty filter: {}. It matches every single document — no conditions, no restrictions.",
      "Your first mission: ask MongoDB for everything.",
    ],
    task: "Write a find() query that returns every car in the collection.",
    hint: 'An empty filter object matches everything: { "filter": {} }',
    starterTemplate: `{
  "filter": {}
}`,
    correctAnswer: { filter: {} },
    explanation: [
      'The filter {} has no conditions, so every document is a match.',
      "You'll use this trick constantly — to sanity-check a collection before narrowing it down.",
    ],
  },
  {
    id: "equality-filter",
    chapter: 2,
    title: "Exact Matches",
    collection: "cars",
    mode: "find",
    timeLimitSeconds: 300,
    narration: [
      'To narrow results down, add a field and the exact value you want: { "Marke": "AUDI" }.',
      "MongoDB compares that value against every document and keeps only the ones where it matches exactly.",
      "This is the equivalent of Python's df[df.Marke == 'AUDI'] — but expressed as MQL.",
    ],
    task: 'Find every car whose Fuel_Type is exactly "Diesel".',
    hint: 'Match a field to an exact value: { "filter": { "Fuel_Type": "Diesel" } }',
    starterTemplate: `{
  "filter": {
    "Fuel_Type": ""
  }
}`,
    correctAnswer: { filter: { Fuel_Type: "Diesel" } },
    explanation: [
      '{ "Fuel_Type": "Diesel" } is shorthand for { "Fuel_Type": { "$eq": "Diesel" } }.',
      "Every field you add to a filter object narrows the results further — MongoDB requires ALL of them to match.",
    ],
  },
  {
    id: "comparison-operators",
    chapter: 3,
    title: "Comparison Operators",
    collection: "cars",
    mode: "find",
    timeLimitSeconds: 300,
    narration: [
      "Exact matches aren't enough for numbers like price — you usually want a range.",
      'MongoDB gives you operators for that: $gt (greater than), $gte, $lt (less than), $lte, and $ne (not equal).',
      'They combine with a field like this: { "PS": { "$gt": 100, "$lt": 200 } } — horsepower between 100 and 200.',
      "You can also stack multiple fields in one filter — MongoDB treats them as AND conditions.",
    ],
    task: 'Find every Benzin (petrol) car priced strictly between CHF 10,000 and CHF 30,000.',
    hint: 'Combine two conditions: { "filter": { "Fuel_Type": "Benzin", "Price": { "$gt": 10000, "$lt": 30000 } } }',
    starterTemplate: `{
  "filter": {
    "Fuel_Type": "Benzin",
    "Price": { "$gt": 0, "$lt": 0 }
  }
}`,
    correctAnswer: {
      filter: { Fuel_Type: "Benzin", Price: { $gt: 10000, $lt: 30000 } },
    },
    explanation: [
      '"Price": { "$gt": 10000, "$lt": 30000 } reads as "price greater than 10000 AND less than 30000".',
      "Two top-level fields in one filter object are combined with AND automatically.",
    ],
  },
  {
    id: "in-or",
    chapter: 4,
    title: "Matching Several Values",
    collection: "restaurants",
    mode: "find",
    timeLimitSeconds: 300,
    narration: [
      "New dataset: Swiss restaurants, each with a cuisine, a city, and a few amenities.",
      'What if you want documents matching ANY of several values? Use $in: { "cuisine": { "$in": ["thai", "chinese"] } }.',
      'You could also spell it out with $or: { "$or": [ { "cuisine": "thai" }, { "cuisine": "chinese" } ] } — same result, more typing.',
    ],
    task: "Find every restaurant that serves pizza or burger.",
    hint: 'Use $in with a list of values: { "filter": { "cuisine": { "$in": ["pizza", "burger"] } } }',
    starterTemplate: `{
  "filter": {
    "cuisine": { "$in": [] }
  }
}`,
    correctAnswer: { filter: { cuisine: { $in: ["pizza", "burger"] } } },
    explanation: [
      "$in matches a document if the field equals ANY value in the array.",
      "$or works too, and is more flexible when the alternatives involve different fields, not just different values of the same one.",
    ],
  },
  {
    id: "projection-sort",
    chapter: 5,
    title: "Projection & Sorting",
    collection: "restaurants",
    mode: "find",
    timeLimitSeconds: 300,
    checkOrder: true,
    narration: [
      "Once you've filtered documents down, you often don't need every field back — just a couple.",
      'A projection picks fields to include: { "city": 1, "postcode": 1 } returns only those two.',
      'Sorting works the same way as pandas: { "postcode": 1 } for ascending, { "postcode": -1 } for descending.',
      "Both go into the query envelope alongside the filter.",
    ],
    task: 'Find vegetarian-friendly restaurants in "Zürich". Show only their name and cuisine, sorted alphabetically by name (A→Z).',
    hint: 'Keep the filter, then add "sort": { "name": 1 } and "projection": { "name": 1, "cuisine": 1 }',
    starterTemplate: `{
  "filter": {
    "city": "Zürich",
    "vegetarian": "yes"
  },
  "sort": {},
  "projection": {}
}`,
    correctAnswer: {
      filter: { city: "Zürich", vegetarian: "yes" },
      sort: { name: 1 },
      projection: { name: 1, cuisine: 1 },
    },
    explanation: [
      "The filter narrows down to matching documents first.",
      '"sort": { "name": 1 } then orders the results A→Z before...',
      '"projection": { "name": 1, "cuisine": 1 } strips every field except the two you listed.',
    ],
  },
  {
    id: "aggregation-group",
    chapter: 6,
    title: "Aggregation: Group & Count",
    collection: "restaurants",
    mode: "aggregate",
    timeLimitSeconds: 300,
    checkOrder: true,
    narration: [
      "For anything beyond filtering, MongoDB has the aggregation pipeline — a list of stages, each transforming the data in sequence.",
      '$group is the big one: { "$group": { "_id": "$cuisine", "count": { "$sum": 1 } } } groups documents by cuisine and counts them.',
      '"$cuisine" with a dollar sign means "the value of the cuisine field" — that\'s how pipeline stages reference document fields.',
      'Follow it with { "$sort": { "count": -1 } } to rank groups from most to fewest.',
    ],
    task: "Count how many restaurants are in each city, ranked from most to fewest.",
    hint: 'Group by "$city" this time: [ { "$group": { "_id": "$city", "count": { "$sum": 1 } } }, { "$sort": { "count": -1 } } ]',
    starterTemplate: `[
  { "$group": { "_id": "", "count": { "$sum": 1 } } },
  { "$sort": { "count": -1 } }
]`,
    correctAnswer: [
      { $group: { _id: "$city", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ],
    explanation: [
      '$group collapses many documents into one per distinct "_id" value — here, one per city.',
      '{ "$sum": 1 } adds 1 for every document in the group, which is just a count.',
      "$sort then orders the grouped results, exactly like sorting a find() result.",
    ],
  },
];

export function getLessonById(id) {
  return lessons.find((l) => l.id === id);
}
