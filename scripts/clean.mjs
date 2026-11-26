// Removes the build output. Plain Node so it works on every platform.
import { rmSync } from "node:fs";

rmSync(new URL("../dist", import.meta.url), { recursive: true, force: true });
