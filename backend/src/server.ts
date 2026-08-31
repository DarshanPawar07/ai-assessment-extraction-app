import dotenv from "dotenv";
import app from "./app";

dotenv.config();

const PORT = Number(process.env.PORT) || 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Backend server running on port ${PORT}`);
});

app.get("/", (req, res) => {
  res.status(200).send("AI Assessment Backend is running");
});

app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "Backend is healthy",
  });
});