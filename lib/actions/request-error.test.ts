import { UnrecognizedActionError } from "next/dist/client/components/unrecognized-action-error";
import { describe, expect, it } from "vitest";

import { OFFLINE_MESSAGE, REFRESH_MESSAGE, requestErrorMessage } from "./request-error";

describe("requestErrorMessage", () => {
  it("asks for a refresh when the server no longer knows the action (a new deploy)", () => {
    expect(requestErrorMessage(new UnrecognizedActionError("Server Action not found"))).toBe(REFRESH_MESSAGE);
  });

  it("keeps the connection message for other failures", () => {
    expect(requestErrorMessage(new TypeError("Failed to fetch"))).toBe(OFFLINE_MESSAGE);
    expect(requestErrorMessage(new TypeError("Failed to fetch"), "Press Confirm again.")).toBe("Press Confirm again.");
  });
});
