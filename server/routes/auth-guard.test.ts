/**
 * Auth-guard static audit — server/routes.ts
 *
 * Reads the monolithic server/routes.ts source and asserts that every
 * route registration line for the four core resource groups
 * (notes, projects, clients, tasks) includes `requireAuth`.
 *
 * Why static analysis instead of supertest?
 *   server/routes.ts is a single ~5000-line file that takes an `express.Application`
 *   as a parameter and registers hundreds of routes. Spinning up the full app in a
 *   test would require mocking dozens of services, storage, and DB layers. Static
 *   analysis catches the same class of regression (someone accidentally removing
 *   `requireAuth` from a line) with zero runtime overhead and zero mock maintenance.
 *
 * What this catches:
 *   A developer who deletes `requireAuth,` from a route line will cause a test
 *   to fail immediately, surfacing the oversight before it reaches production.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

const routesSrc = readFileSync(
  path.resolve(__dirname, "../routes.ts"),
  "utf-8"
);
const lines = routesSrc.split("\n");

/**
 * Extracts every line that registers an HTTP route (via app.get / app.post /
 * app.put / app.patch / app.delete) whose path starts with the given prefix.
 */
function routeLinesFor(prefix: string): string[] {
  const routeMethodPattern = /^\s*app\.(get|post|put|patch|delete)\(/;
  return lines.filter(
    (line) => routeMethodPattern.test(line) && line.includes(`"${prefix}`)
  );
}

const RESOURCES = [
  { name: "notes",    prefix: "/api/notes" },
  { name: "projects", prefix: "/api/projects" },
  { name: "clients",  prefix: "/api/clients" },
  { name: "tasks",    prefix: "/api/tasks" },
] as const;

describe("Auth-guard audit — server/routes.ts", () => {
  for (const { name, prefix } of RESOURCES) {
    describe(`${name} routes (${prefix})`, () => {
      const matched = routeLinesFor(prefix);

      it(`detects at least one ${name} route registration (sanity check)`, () => {
        expect(matched.length).toBeGreaterThan(0);
      });

      it(`every ${name} route includes requireAuth`, () => {
        const unprotected = matched.filter((line) => !line.includes("requireAuth"));
        expect(
          unprotected,
          `Found ${name} routes WITHOUT requireAuth:\n${unprotected.join("\n")}`
        ).toHaveLength(0);
      });

      it(`every ${name} route includes requireOrgMember`, () => {
        const unguarded = matched.filter((line) => !line.includes("requireOrgMember"));
        expect(
          unguarded,
          `Found ${name} routes WITHOUT requireOrgMember:\n${unguarded.join("\n")}`
        ).toHaveLength(0);
      });
    });
  }

  describe("Overall routes.ts wiring", () => {
    it("imports requireAuth from the auth middleware", () => {
      expect(routesSrc).toContain('from "./middleware/auth"');
      expect(routesSrc).toContain("requireAuth");
    });

    it("imports requireOrgMember from the auth middleware", () => {
      expect(routesSrc).toContain("requireOrgMember");
    });
  });
});
