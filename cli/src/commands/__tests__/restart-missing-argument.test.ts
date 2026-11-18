// Copyright (c) 2026 Flisk Landscape contributors
// SPDX-License-Identifier: MIT
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { captureExit, parseEnvelope, runFlisk } from "../../test-support/index.js";
import { restartCommand } from "../restart.js";

const HINT = "Run `flisk resources` to see the resource names you can restart.";

describe("flisk restart with no resource argument (#4416)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prints the missing-argument error and then the flisk resources hint", async () => {
    const stderr: string[] = [];
    restartCommand.configureOutput({ writeErr: (text) => stderr.push(text) });
    const { exit, expectExit } = captureExit();
    try {
      await expect(restartCommand.parseAsync([], { from: "user" })).rejects.toThrow();
      // Assert before `mockRestore`, which clears the recorded calls.
      expectExit(1);
    } finally {
      exit.mockRestore();
      restartCommand.configureOutput({ writeErr: (text) => process.stderr.write(text) });
    }
    const output = stderr.join("");
    expect(output).toContain("error: missing required argument 'resource'");
    expect(output).toContain(HINT);
    expect(output.indexOf("error: missing required argument")).toBeLessThan(output.indexOf(HINT));
  });

  it("flisk restart prints the hint through the real CLI", () => {
    const result = runFlisk(["restart"], { cwd: process.cwd() });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("error: missing required argument 'resource'");
    expect(result.stderr).toContain(HINT);
  });

  it("flisk restart --json keeps the envelope on stdout and leaves stderr empty", () => {
    const result = runFlisk(["restart", "--json"], { cwd: process.cwd() });
    expect(result.status).toBe(1);
    expect(result.stderr).toBe("");
    const envelope = parseEnvelope(result.stdout);
    expect(envelope.schemaVersion).toBe(1);
    expect(envelope.errors).toHaveLength(1);
    expect(envelope.errors[0]?.code).toBe("USAGE");
    expect(envelope.errors[0]?.message).toBe("error: missing required argument 'resource'");
  });

  it("still accepts a named resource and prints no hint", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "flisk-restart-hint-"));
    try {
      fs.mkdirSync(path.join(tmp, ".flisk"), { recursive: true });
      fs.writeFileSync(path.join(tmp, ".flisk", "project.json"), "{}\n");
      fs.mkdirSync(path.join(tmp, "services", "api"), { recursive: true });
      fs.writeFileSync(
        path.join(tmp, "services", "api", "service.json"),
        JSON.stringify({ appName: "api", appType: "backend", port: 4000 }),
      );

      const result = runFlisk(["restart", "api", "--json", "--port=59999"], { cwd: tmp });
      expect(result.stderr).toBe("");
      expect(result.stderr).not.toContain(HINT);
      expect(result.stdout).not.toContain("missing required argument");
      const envelope = parseEnvelope(result.stdout);
      expect(envelope.errors[0]?.code).toBe("TILT_NOT_RUNNING");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
