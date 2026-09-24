const mongoose = require("mongoose");
const { mongoUri } = require("./env");

async function connectDB() {
  mongoose.set("strictQuery", true);
  await mongoose.connect(mongoUri);
  console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);

  // Mongoose builds indexes (incl. the partial-unique no-duplicate-application index)
  // in the background by default, so a request racing the very first connection could
  // land before the index exists. Block startup on index creation instead, so every
  // model's indexes (including uniqueness constraints) are guaranteed to be live before
  // the server accepts its first request.
  await Promise.all(Object.values(mongoose.connection.models).map((model) => model.init()));
}

module.exports = connectDB;
