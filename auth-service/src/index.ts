import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

/**
 *  Dummy authentication endpoint
 *  Returns true as long as the service is running.
 */
app.get("/auth", (req, res) => {
  res.json({ authenticated: true });
});

app.listen(PORT, () => {
  console.log(`Auth service running on port ${PORT}`);
});