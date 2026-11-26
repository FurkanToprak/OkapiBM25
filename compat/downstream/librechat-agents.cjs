// Runs the part of @librechat/agents that calls okapibm25: the local tool
// search (performLocalSearch in src/tools/ToolSearch.ts). It scores a set of
// tool descriptions against a query with BM25 and returns the ranked matches.
//
// Loading the package is already a check: it resolves the BM25 function from
// the okapibm25 exports at import time and throws if it cannot.
//
// Prints everything the search returns. downstream.mjs runs this with two
// versions of okapibm25 and compares the output.
const { createToolSearch } = require("@librechat/agents");

const tools = [
  ["create_expense_report", "Create a new expense report for a business trip, with receipts and totals"],
  ["approve_expense_report", "Approve or reject an expense report that an employee submitted"],
  ["search_flights", "Search flights between two airports on a date and list prices"],
  ["book_hotel", "Book a hotel room in a city for a number of nights"],
  ["get_weather", "Get the weather forecast for a city, with temperature and rain"],
  ["send_email", "Send an email message to one or more people, with attachments"],
  ["compile_cpp", "Compile a C++ source file with a compiler and report the errors"],
  ["query_database", "Run a SQL query on the reporting database and return the rows"],
  ["translate_text", "Translate text from one language to another language"],
  ["summarize_document", "Summarize a long document or report into a few sentences"],
  ["resize_image", "Resize an image file to a width and height in pixels"],
  ["empty_description", ""],
];

const toolRegistry = new Map(
  tools.map(([name, description]) => [name, { name, description, defer_loading: true }]),
);

const queries = [
  "expense",
  "expense report",
  "report",
  "weather forecast city",
  "c++ compiler",
  "send (email) to people?",
  "a.*b",
  "language",
  "image width height pixels",
  "nothing matches this zzzz",
  "",
];

(async () => {
  const search = createToolSearch({ mode: "local", toolRegistry });
  const results = [];
  for (const query of queries) {
    for (const fields of [["name", "description"], ["description"]]) {
      results.push({ query, fields, found: await search.invoke({ query, fields, max_results: 10 }) });
    }
  }
  console.log(JSON.stringify(results, null, 1));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
