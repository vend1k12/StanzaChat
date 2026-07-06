# Changelog

## 0.1.0 (2026-07-06)


### Features

* **ai:** per-model settings resolver + OpenAI-family discovery + chat-completions default ([ff8e78b](https://github.com/vend1k12/StanzaChat/commit/ff8e78be7bbf54d2dedcfde77f2964bfd00408ad))
* **db:** add provider_models table for per-model settings ([502fdbc](https://github.com/vend1k12/StanzaChat/commit/502fdbcc24e53e18a9f6167d3d8bff86905c042d))
* Phase 1 — data & auth core ([6e77b72](https://github.com/vend1k12/StanzaChat/commit/6e77b72ad5098b1512dd073e2c8505805e9d744b)), closes [#18](https://github.com/vend1k12/StanzaChat/issues/18)
* Phase 1 — data & auth core ([#18](https://github.com/vend1k12/StanzaChat/issues/18)) ([6e77b72](https://github.com/vend1k12/StanzaChat/commit/6e77b72ad5098b1512dd073e2c8505805e9d744b))
* Phase 2 — AI core ([#19](https://github.com/vend1k12/StanzaChat/issues/19)) ([b803888](https://github.com/vend1k12/StanzaChat/commit/b80388808c6475a586ed52734ad35a4bfd1f5e56))
* Phase 4 — admin panel & audit ([bb7cedc](https://github.com/vend1k12/StanzaChat/commit/bb7cedc0e112d8c3e5d7ce36c14fef3878843674))
* **shared:** structured validation errors + discover/per-model schemas ([1e8e655](https://github.com/vend1k12/StanzaChat/commit/1e8e6555168cd64e19c75a196bcde4583aaf949f))
* **web:** admin providers — full edit, /v1/models discovery, per-model settings ([be73d70](https://github.com/vend1k12/StanzaChat/commit/be73d707579b278336e0a362fd1645625ee953f3))
* **web:** admin surface polish — full-height sidebar + Cards/Table view toggle ([8feea7d](https://github.com/vend1k12/StanzaChat/commit/8feea7dfd9f59dee89279ce8f612dc6c732f7564))
* **web:** Phase 3 workspace UI baseline + review-driven follow-up ([33c94df](https://github.com/vend1k12/StanzaChat/commit/33c94df6c067cb03fd61810b0953405ee00704e4))
* **web:** proper dark theme + theme toggle ([1950774](https://github.com/vend1k12/StanzaChat/commit/1950774fd4c66f377897f27805a441d05bbfacaf))
* **web:** workspace UX polish — draft chats, root redirect, AlertDialog confirms ([6e44b75](https://github.com/vend1k12/StanzaChat/commit/6e44b7505efdf8557bcfd45a51d36e08221ba5b4))


### Bug Fixes

* **ai,web:** make chat streaming actually work end-to-end ([1248b4a](https://github.com/vend1k12/StanzaChat/commit/1248b4a3a6b520206ee819a7318c9f62fdcefcc1))
* **ai:** strip trailing slashes without a ReDoS-flagged greedy regex ([19e0dcc](https://github.com/vend1k12/StanzaChat/commit/19e0dccdde0ceebda4537deb5f012d3694805e22))
* **db,ai:** make assistant-turn persistence all-or-nothing ([0b4a5d6](https://github.com/vend1k12/StanzaChat/commit/0b4a5d63106f78a2b9de6d1bab98414edcf0b696))
* **web,db:** self-lockout guard + admin panel warm-canvas redesign ([d7fe057](https://github.com/vend1k12/StanzaChat/commit/d7fe05732ed4b9872edf4b01d0e1602e84ec389f))
* **web:** defer draft-&gt;real URL swap until the stream finishes ([9de4ca1](https://github.com/vend1k12/StanzaChat/commit/9de4ca195ce863729c8ce0d2d7cd5b10a33689a6))
* **web:** drive sandbox markdown from a single MARKDOWN_STEPS source ([8ce11f9](https://github.com/vend1k12/StanzaChat/commit/8ce11f959a56b3f6819cc7fec89c02dd629c5ab3))
* **web:** flush deferred URL swap in the SAME effect that clears prevStatus ([24c1e4b](https://github.com/vend1k12/StanzaChat/commit/24c1e4bc6bc972b29af454be18721e816e0dca07))
* **web:** give useChat a stable session id across draft-&gt;real transition ([be93282](https://github.com/vend1k12/StanzaChat/commit/be9328221f65c7309c8ff1a55d726b1bb7a263f7))
* **web:** omit undefined per-model settings from streamText ([4724cdc](https://github.com/vend1k12/StanzaChat/commit/4724cdcfe49bf89dd04957eab28138b5f4a9599c))
* **web:** route every API handler through the wrapRoute mapper ([ade3912](https://github.com/vend1k12/StanzaChat/commit/ade39129366b1ab2fd4c246afcb4048ebff07a87))
* **web:** swap draft-&gt;real URL via history.replaceState, not router.replace ([b27c78e](https://github.com/vend1k12/StanzaChat/commit/b27c78e0a3696c878473459cabef76fc21a0c557))
* **web:** unify /chats and /chats/{id} into one route segment ([298cc3c](https://github.com/vend1k12/StanzaChat/commit/298cc3c15693617da5046b8d1bcc360d3801b1d2))


### Code Refactoring

* **web,ai:** extract chat streaming into packages/ai + sandbox unit tests ([3c69f7f](https://github.com/vend1k12/StanzaChat/commit/3c69f7f03d9b390de92c11bfd60f94f4b4a55e31))
* **web:** drop ReturnType&lt;&gt; exposure from auth glue; align E2E with new UX ([ad82248](https://github.com/vend1k12/StanzaChat/commit/ad82248247e39c923da8c56360114601d0e7b26c))
* **web:** unified parseWithSchema + ApiError.details plumbing ([417c6e4](https://github.com/vend1k12/StanzaChat/commit/417c6e41229aa8686521937d727aae327d7729fe))


### Documentation

* **repo:** changeset for v0.1 UX polish + admin edit/discover ([77d5d8b](https://github.com/vend1k12/StanzaChat/commit/77d5d8b740f347d5c5f3d867984443626161e87b))
* **repo:** define solo maintainer review policy ([#13](https://github.com/vend1k12/StanzaChat/issues/13)) ([ac1d43b](https://github.com/vend1k12/StanzaChat/commit/ac1d43bc5b6e2ffa203d1341460137a82ca168f2))


### Chores

* ignore session-local tooling and drizzle-kit snapshots ([1ce8b49](https://github.com/vend1k12/StanzaChat/commit/1ce8b4992f748d0f1b0e443a062446d5248945d7))
* prettier --write on new files (whitespace only) ([7bf9229](https://github.com/vend1k12/StanzaChat/commit/7bf9229b69c09aaa0f3a67f682558606795a8718))
* **repo:** establish repository foundation ([4c7f3d5](https://github.com/vend1k12/StanzaChat/commit/4c7f3d51991dea9958c9b00b0391bc92e20cdfb5))
* **repo:** replace dependabot with renovate ([#16](https://github.com/vend1k12/StanzaChat/issues/16)) ([c25d131](https://github.com/vend1k12/StanzaChat/commit/c25d131868552d771d92eab69ce8b4928ebe425c))
* **repo:** tune renovate approval scope and node handling ([#17](https://github.com/vend1k12/StanzaChat/issues/17)) ([53050b8](https://github.com/vend1k12/StanzaChat/commit/53050b83528f15aaeacd385fc2fc34417525b7f4))
* **shared,ai:** appease repo-wide lint on new files ([4a24991](https://github.com/vend1k12/StanzaChat/commit/4a249914ead0a2ebf730ae5b3b53422a834e1a68))
