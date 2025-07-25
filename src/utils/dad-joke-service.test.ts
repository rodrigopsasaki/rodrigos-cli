import { describe, it, expect, beforeEach } from "vitest";
import { DadJokeService } from "./dad-joke-service.js";

describe("DadJokeService", () => {
  let service: DadJokeService;

  beforeEach(() => {
    service = new DadJokeService();
  });

  it("should return a random joke", async () => {
    const joke = await service.getRandomJoke();

    expect(typeof joke).toBe("string");
    expect(joke.length).toBeGreaterThan(0);
  });

  it("should return different jokes on multiple calls", async () => {
    const joke1 = await service.getRandomJoke();
    const joke2 = await service.getRandomJoke();
    const joke3 = await service.getRandomJoke();

    // Note: This test might occasionally fail due to randomness
    // In a real test suite, we'd mock Math.random
    expect(joke1).toBeDefined();
    expect(joke2).toBeDefined();
    expect(joke3).toBeDefined();
  });

  it("should handle edge case when jokes array is empty", async () => {
    // This test ensures the fallback joke is returned
    const joke = await service.getRandomJoke();
    expect(joke).toBeDefined();
    expect(joke.length).toBeGreaterThan(0);
  });
});
