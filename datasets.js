// Explicit JSON imports work in Node.js and can be bundled by Wrangler.
module.exports = {
  allQuestionsList: require('./public/api/real/all_questions.json'),
  indexAll: require('./public/api/real/index-all.json'),
  indexMain: require('./public/api/real/index-main.json'),
  realMeta: require('./public/api/real/meta.json'),
  syllabus: require('./public/api/syllabus.json'),
  pojueMethods: require('./public/data/pojue-methods.json'),
  pojueGraph: require('./public/data/pojue-graph.json')
};
