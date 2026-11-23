window.__ModuleLoader__.load({
  id: "dsh-multi-workspace",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    "use strict";
    var __create = Object.create;
    var __defProp = Object.defineProperty;
    var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
    var __getOwnPropNames = Object.getOwnPropertyNames;
    var __getProtoOf = Object.getPrototypeOf;
    var __hasOwnProp = Object.prototype.hasOwnProperty;
    var __export = (target, all) => {
      for (var name in all)
        __defProp(target, name, { get: all[name], enumerable: true });
    };
    var __copyProps = (to, from, except, desc) => {
      if (from && typeof from === "object" || typeof from === "function") {
        for (let key of __getOwnPropNames(from))
          if (!__hasOwnProp.call(to, key) && key !== except)
            __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
      }
      return to;
    };
    var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
      // If the importer is in node compatibility mode or this is not an ESM
      // file that has been converted to a CommonJS file using a Babel-
      // compatible transform (i.e. "__esModule" has not been set), then set
      // "default" to the CommonJS "module.exports" for node compatibility.
      isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
      mod
    ));
    var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

    // src/client/index.ts
    var index_exports = {};
    __export(index_exports, {
      apply: () => apply,
      inject: () => inject
    });
    module.exports = __toCommonJS(index_exports);

    // src/client/locale.ts
    var NS = "multi-workspace";
    var zh = {
      "picker.message": "\u9009\u62E9\u6587\u4EF6\u5939\uFF08\u53EF\u591A\u9009\uFF1A\u9009 2 \u4E2A\u53CA\u4EE5\u4E0A\u4F1A\u521B\u5EFA\u7EC4\u5408\u5DE5\u4F5C\u533A\uFF09",
      "dialog.title": "\u9009\u62E9\u6587\u4EF6\u5939",
      "dialog.subtitle": "\u9009 1 \u4E2A\u6587\u4EF6\u5939\u4F1A\u76F4\u63A5\u6253\u5F00\uFF1B\u9009 2 \u4E2A\u53CA\u4EE5\u4E0A\u4F1A\u521B\u5EFA\u4E00\u4E2A\u7EC4\u5408\u5DE5\u4F5C\u533A\u3002",
      "dialog.home": "\u4E3B\u76EE\u5F55",
      "dialog.root": "\u6839\u76EE\u5F55",
      "dialog.loading": "\u6B63\u5728\u8BFB\u53D6\u2026",
      "dialog.empty": "\u8FD9\u91CC\u6CA1\u6709\u5B50\u6587\u4EF6\u5939",
      "dialog.hidden": "\u663E\u793A\u9690\u85CF\u6587\u4EF6\u5939",
      "dialog.hiddenTag": "\u9690\u85CF",
      "dialog.refresh": "\u5237\u65B0",
      "dialog.truncated": "\u6587\u4EF6\u5939\u8FC7\u591A\uFF0C\u53EA\u663E\u793A\u524D\u4E00\u90E8\u5206\u3002",
      "dialog.selected": "\u5DF2\u9009 {count} \u4E2A",
      "dialog.remove": "\u79FB\u9664 {name}",
      "dialog.max": "\u6700\u591A\u9009\u62E9 64 \u4E2A\u6587\u4EF6\u5939\u3002",
      "dialog.cancel": "\u53D6\u6D88",
      "dialog.open": "\u6253\u5F00\u6B64\u6587\u4EF6\u5939",
      "dialog.create": "\u521B\u5EFA\u7EC4\u5408\u5DE5\u4F5C\u533A",
      "dialog.creating": "\u6B63\u5728\u521B\u5EFA\u2026",
      "dialog.alreadyMember": "\u5DF2\u5728\u5DE5\u4F5C\u533A\u4E2D",
      "menu.add": "\u6DFB\u52A0\u6587\u4EF6\u5939\u2026",
      "menu.remove": "\u79FB\u9664\u6587\u4EF6\u5939\u2026",
      "manage.pickMessage": "\u9009\u62E9\u8981\u6DFB\u52A0\u5230\u6B64\u5DE5\u4F5C\u533A\u7684\u6587\u4EF6\u5939\uFF08\u53EF\u591A\u9009\uFF09",
      "manage.add.title": "\u5411\u201C{name}\u201D\u6DFB\u52A0\u6587\u4EF6\u5939",
      "manage.add.subtitle": "\u9009\u4E2D\u7684\u6587\u4EF6\u5939\u4F1A\u4EE5\u7B26\u53F7\u94FE\u63A5\u52A0\u5165\uFF1B\u4E0D\u4F1A\u79FB\u52A8\u6216\u590D\u5236\u5B83\u4EEC\u7684\u5185\u5BB9\u3002",
      "manage.add.confirm": "\u6DFB\u52A0",
      "manage.add.pending": "\u6B63\u5728\u6DFB\u52A0\u2026",
      "manage.remove.title": "\u4ECE\u201C{name}\u201D\u79FB\u9664\u6587\u4EF6\u5939",
      "manage.remove.subtitle": "\u53EA\u79FB\u9664\u94FE\u63A5\uFF0C\u78C1\u76D8\u4E0A\u7684\u6587\u4EF6\u5939\u4FDD\u6301\u539F\u6837\u3002",
      "manage.remove.confirm": "\u79FB\u9664",
      "manage.remove.pending": "\u6B63\u5728\u79FB\u9664\u2026",
      "manage.remove.minimum": "\u4E00\u4E2A\u7EC4\u5408\u5DE5\u4F5C\u533A\u81F3\u5C11\u4FDD\u7559 {count} \u4E2A\u6587\u4EF6\u5939\u3002",
      "manage.cancel": "\u53D6\u6D88",
      "manage.close": "\u5173\u95ED",
      "manage.failed": "\u64CD\u4F5C\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\u3002"
    };
    var en = {
      "picker.message": "Choose folders (select 2 or more to create a combined workspace)",
      "dialog.title": "Choose folders",
      "dialog.subtitle": "One folder opens directly; two or more folders become one combined workspace.",
      "dialog.home": "Home",
      "dialog.root": "Root",
      "dialog.loading": "Reading\u2026",
      "dialog.empty": "No subfolders here",
      "dialog.hidden": "Show hidden folders",
      "dialog.hiddenTag": "hidden",
      "dialog.refresh": "Refresh",
      "dialog.truncated": "Too many folders; only the beginning is shown.",
      "dialog.selected": "{count} selected",
      "dialog.remove": "Remove {name}",
      "dialog.max": "At most 64 folders can be selected.",
      "dialog.cancel": "Cancel",
      "dialog.open": "Open this folder",
      "dialog.create": "Create combined workspace",
      "dialog.creating": "Creating\u2026",
      "dialog.alreadyMember": "already in workspace",
      "menu.add": "Add folders\u2026",
      "menu.remove": "Remove folders\u2026",
      "manage.pickMessage": "Choose folders to add to this workspace (multiple selection)",
      "manage.add.title": "Add folders to \u201C{name}\u201D",
      "manage.add.subtitle": "Picked folders join as symlinks; nothing is moved or copied.",
      "manage.add.confirm": "Add",
      "manage.add.pending": "Adding\u2026",
      "manage.remove.title": "Remove folders from \u201C{name}\u201D",
      "manage.remove.subtitle": "Only the links go; the folders on disk stay untouched.",
      "manage.remove.confirm": "Remove",
      "manage.remove.pending": "Removing\u2026",
      "manage.remove.minimum": "A combined workspace keeps at least {count} folders.",
      "manage.cancel": "Cancel",
      "manage.close": "Close",
      "manage.failed": "That did not work. Please try again."
    };

    // src/client/remote.ts
    var import_zod3 = require("zod");

    // src/shared/remote-info.ts
    var NamedInput = class {
      #parameters;
      #strict;
      #zod;
      constructor(parameters, strict, zod) {
        this.#parameters = parameters;
        this.#strict = strict;
        this.#zod = zod;
      }
      parse(input) {
        const shape = {};
        for (const parameter of this.#parameters) {
          const codec = this.#strict ? parameter.strictCodec ?? parameter.codec : parameter.codec;
          shape[parameter.wire] = codec.create();
        }
        if (this.#strict) return this.#zod.object(shape).parse(input);
        return this.#zod.object(shape).parse(input);
      }
    };
    var RemoteInfoImpl = class {
      #spec;
      #zod;
      #index;
      constructor(spec, zod) {
        this.#spec = spec;
        this.#zod = zod;
      }
      get package() {
        return this.#spec.package;
      }
      get descriptors() {
        return this.#resolve().descriptors;
      }
      get methods() {
        return this.#resolve().methods;
      }
      #resolve() {
        if (this.#index !== void 0) return this.#index;
        const descriptors = [];
        const methods = /* @__PURE__ */ Object.create(null);
        for (const [endpoint, definition] of Object.entries(this.#spec.methods)) {
          const separator = endpoint.indexOf("/");
          const namespace = endpoint.slice(0, separator);
          const method = endpoint.slice(separator + 1);
          const parameters = definition.parameters.map((parameter) => ({
            ...parameter,
            wire: parameter.wire ?? parameter.name
          }));
          const result = definition.result;
          const descriptor = {
            ...definition,
            id: `${this.#spec.package}#${endpoint}`,
            namespace,
            method,
            parameters,
            result
          };
          if (definition.invocation.kind === "direct") {
            const inputs = [];
            const zodRuntime = zodRef(this.#zod);
            Object.assign(descriptor, {
              input(options) {
                const strict = options?.strict === true;
                const index = strict ? 1 : 0;
                return inputs[index] ??= new NamedInput(parameters, strict, zodRuntime);
              },
              invoke(remote, input, signal) {
                const values = parameters.map((parameter) => input[parameter.wire]);
                if (definition.cancellation !== void 0) values.push(signal);
                const receiver = Reflect.get(remote, namespace);
                const call = receiver[method];
                return call?.apply(receiver, values);
              }
            });
            methods[endpoint] = descriptor;
          }
          descriptors.push(descriptor);
        }
        this.#index = { descriptors, methods };
        return this.#index;
      }
    };
    function zodRef(zod) {
      return zod;
    }
    function createTypertRemoteInfo(spec, zod) {
      return new RemoteInfoImpl(spec, zod);
    }

    // src/shared/remote-spec.ts
    var import_zod2 = require("zod");

    // src/shared/rpc.ts
    var import_zod = require("zod");
    var PACKAGE_NAME = "dsh-multi-workspace";
    var NAMESPACE = "multiWorkspace";
    var CREATE_METHOD = "create";
    var CREATE_ENDPOINT = `${NAMESPACE}/${CREATE_METHOD}`;
    var PICK_METHOD = "pick";
    var PICK_ENDPOINT = `${NAMESPACE}/${PICK_METHOD}`;
    var LIST_METHOD = "list";
    var LIST_ENDPOINT = `${NAMESPACE}/${LIST_METHOD}`;
    var INSPECT_METHOD = "inspect";
    var INSPECT_ENDPOINT = `${NAMESPACE}/${INSPECT_METHOD}`;
    var ADD_METHOD = "addFolders";
    var ADD_ENDPOINT = `${NAMESPACE}/${ADD_METHOD}`;
    var REMOVE_METHOD = "removeFolders";
    var REMOVE_ENDPOINT = `${NAMESPACE}/${REMOVE_METHOD}`;
    var MIN_MEMBERS = 2;
    var zLink = import_zod.z.object({
      name: import_zod.z.string().min(1),
      target: import_zod.z.string().min(1)
    });
    var createRequestSchema = import_zod.z.object({
      paths: import_zod.z.array(import_zod.z.string().min(1)).min(1).max(64),
      title: import_zod.z.string().min(1).max(512).optional()
    });
    var createResultSchema = import_zod.z.object({
      path: import_zod.z.string().min(1),
      title: import_zod.z.string().min(1),
      titleAuto: import_zod.z.boolean(),
      workspaceId: import_zod.z.string().min(1),
      created: import_zod.z.boolean(),
      links: import_zod.z.array(zLink),
      sources: import_zod.z.array(import_zod.z.string().min(1))
    });
    var inspectRequestSchema = import_zod.z.object({
      path: import_zod.z.string().min(1)
    });
    var workspaceInfoSchema = import_zod.z.object({
      path: import_zod.z.string().min(1),
      title: import_zod.z.string().min(1),
      titleAuto: import_zod.z.boolean(),
      members: import_zod.z.array(zLink),
      workspaceId: import_zod.z.string().min(1).optional()
    });
    var inspectResultSchema = import_zod.z.union([import_zod.z.null(), workspaceInfoSchema]);
    var addRequestSchema = import_zod.z.object({
      path: import_zod.z.string().min(1),
      paths: import_zod.z.array(import_zod.z.string().min(1)).min(1).max(64)
    });
    var removeRequestSchema = import_zod.z.object({
      path: import_zod.z.string().min(1),
      names: import_zod.z.array(import_zod.z.string().min(1)).min(1).max(64)
    });
    var updateResultSchema = import_zod.z.object({
      path: import_zod.z.string().min(1),
      title: import_zod.z.string().min(1),
      titleAuto: import_zod.z.boolean(),
      members: import_zod.z.array(zLink),
      changed: import_zod.z.array(zLink)
    });
    var pickMessageSchema = import_zod.z.string().min(1).max(200);
    var pickResultSchema = import_zod.z.union([import_zod.z.null(), import_zod.z.array(import_zod.z.string().min(1))]);
    var zDirectoryEntry = import_zod.z.object({
      name: import_zod.z.string().min(1),
      path: import_zod.z.string().min(1),
      hidden: import_zod.z.boolean()
    });
    var listPathSchema = import_zod.z.union([import_zod.z.null(), import_zod.z.string().min(1)]);
    var listingResultSchema = import_zod.z.object({
      path: import_zod.z.string().min(1),
      home: import_zod.z.string().min(1),
      crumbs: import_zod.z.array(zDirectoryEntry),
      entries: import_zod.z.array(zDirectoryEntry),
      truncated: import_zod.z.boolean()
    });

    // src/shared/remote-spec.ts
    var requestJsonSchema = {
      type: "object",
      properties: {
        paths: {
          type: "array",
          items: { type: "string" },
          minItems: 2,
          maxItems: 64,
          description: "Absolute paths of the folders to link, in selection order."
        },
        title: { type: "string", description: "Optional explicit title override." }
      },
      required: ["paths"],
      additionalProperties: false,
      description: "The folders to link and an optional explicit title override."
    };
    var resultJsonSchema = {
      type: "object",
      properties: {
        path: { type: "string", description: "Absolute path of the real combined workspace directory." },
        title: { type: "string", description: "Durable Workspace title." },
        titleAuto: { type: "boolean", description: "Whether the title is derived from the current folders." },
        workspaceId: { type: "string", description: "Durable Workspace id." },
        created: { type: "boolean", description: "Whether this call materialized the workspace." },
        links: {
          type: "array",
          items: {
            type: "object",
            properties: { name: { type: "string" }, target: { type: "string" } },
            required: ["name", "target"],
            additionalProperties: false
          }
        },
        sources: { type: "array", items: { type: "string" } }
      },
      required: ["path", "title", "titleAuto", "workspaceId", "created", "links", "sources"],
      additionalProperties: false,
      description: "The materialized combined workspace directory and its durable registration."
    };
    var pickResultJsonSchema = {
      oneOf: [
        { type: "null" },
        { type: "array", items: { type: "string" }, description: "Picked absolute folder paths." }
      ],
      description: "The picked absolute folder paths, or null when the operator cancelled."
    };
    var entryJsonSchema = {
      type: "object",
      properties: {
        name: { type: "string" },
        path: { type: "string" },
        hidden: { type: "boolean" }
      },
      required: ["name", "path", "hidden"],
      additionalProperties: false
    };
    var listingJsonSchema = {
      type: "object",
      properties: {
        path: { type: "string", description: "Absolute path of the listed directory." },
        home: { type: "string", description: "The host account's home directory." },
        crumbs: {
          type: "array",
          items: entryJsonSchema,
          description: "Ancestor chain from the filesystem root to the listed directory inclusive."
        },
        entries: {
          type: "array",
          items: entryJsonSchema,
          description: "Direct child directories, name-sorted; symlinks to directories included."
        },
        truncated: { type: "boolean", description: "Whether the level was cut at the result bound." }
      },
      required: ["path", "home", "crumbs", "entries", "truncated"],
      additionalProperties: false,
      description: "One directory level and its ancestry for the in-app browser."
    };
    var requestCodec = {
      mode: "strict",
      typeSymbol: `${PACKAGE_NAME}#WorkspaceCreateRequest`,
      create: () => createRequestSchema,
      jsonSchema: requestJsonSchema,
      description: "the folders to link and an optional explicit title override."
    };
    var resultCodec = {
      mode: "strict",
      typeSymbol: `${PACKAGE_NAME}#WorkspaceCreateResult`,
      create: () => createResultSchema,
      jsonSchema: resultJsonSchema,
      description: "the materialized combined workspace directory and its durable registration."
    };
    var pickMessageCodec = {
      mode: "strict",
      typeSymbol: `${PACKAGE_NAME}#PickMessage`,
      create: () => pickMessageSchema,
      jsonSchema: { type: "string", minLength: 1, maxLength: 200 },
      description: "the prompt the native macOS folder panel shows."
    };
    var pickResultCodec = {
      mode: "strict",
      typeSymbol: `${PACKAGE_NAME}#PickResult`,
      create: () => pickResultSchema,
      jsonSchema: pickResultJsonSchema,
      description: "the picked absolute folder paths, or null when the operator cancelled."
    };
    var listPathCodec = {
      mode: "strict",
      typeSymbol: `${PACKAGE_NAME}#ListPath`,
      create: () => listPathSchema,
      jsonSchema: { oneOf: [{ type: "null" }, { type: "string", minLength: 1 }] },
      description: "absolute directory to list; null lists the home directory."
    };
    var listingResultCodec = {
      mode: "strict",
      typeSymbol: `${PACKAGE_NAME}#DirectoryListing`,
      create: () => listingResultSchema,
      jsonSchema: listingJsonSchema,
      description: "one directory level and its ancestry for the in-app browser."
    };
    var linkJsonSchema = {
      type: "object",
      properties: { name: { type: "string" }, target: { type: "string" } },
      required: ["name", "target"],
      additionalProperties: false
    };
    var infoJsonSchema = {
      type: "object",
      properties: {
        path: { type: "string", description: "Absolute path of the real combined workspace directory." },
        title: { type: "string", description: "Durable Workspace title." },
        titleAuto: { type: "boolean", description: "Whether the title is derived from the current folders." },
        members: { type: "array", items: linkJsonSchema, description: "Symlinks in the directory, in member order." },
        workspaceId: { type: "string", description: "Durable Workspace id, when the directory is registered." }
      },
      required: ["path", "title", "titleAuto", "members"],
      additionalProperties: false
    };
    var inspectParamJsonSchema = {
      type: "object",
      properties: { path: { type: "string", description: "Absolute path of the directory to inspect." } },
      required: ["path"],
      additionalProperties: false
    };
    var addParamJsonSchema = {
      type: "object",
      properties: {
        path: { type: "string", description: "Absolute path of the combined workspace directory." },
        paths: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
          maxItems: 64,
          description: "Absolute paths of the folders to link in."
        }
      },
      required: ["path", "paths"],
      additionalProperties: false
    };
    var removeParamJsonSchema = {
      type: "object",
      properties: {
        path: { type: "string", description: "Absolute path of the combined workspace directory." },
        names: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
          maxItems: 64,
          description: "Entry names to drop from the directory."
        }
      },
      required: ["path", "names"],
      additionalProperties: false
    };
    var updateJsonSchema = {
      type: "object",
      properties: {
        path: { type: "string", description: "Absolute path of the real combined workspace directory." },
        title: { type: "string", description: "Durable Workspace title after the change." },
        titleAuto: { type: "boolean", description: "Whether the title is derived from the current folders." },
        members: { type: "array", items: linkJsonSchema, description: "Symlinks after the change." },
        changed: { type: "array", items: linkJsonSchema, description: "Members added or removed by this call." }
      },
      required: ["path", "title", "titleAuto", "members", "changed"],
      additionalProperties: false
    };
    var inspectParamCodec = {
      mode: "strict",
      typeSymbol: `${PACKAGE_NAME}#WorkspaceInspectRequest`,
      create: () => inspectRequestSchema,
      jsonSchema: inspectParamJsonSchema,
      description: "the combined-workspace directory to describe."
    };
    var inspectResultCodec = {
      mode: "strict",
      typeSymbol: `${PACKAGE_NAME}#WorkspaceInfo`,
      create: () => inspectResultSchema,
      jsonSchema: { oneOf: [{ type: "null" }, infoJsonSchema] },
      description: "the combined workspace, or null when the directory is not one."
    };
    var addParamCodec = {
      mode: "strict",
      typeSymbol: `${PACKAGE_NAME}#WorkspaceAddRequest`,
      create: () => addRequestSchema,
      jsonSchema: addParamJsonSchema,
      description: "the combined workspace and the folders to link into it."
    };
    var removeParamCodec = {
      mode: "strict",
      typeSymbol: `${PACKAGE_NAME}#WorkspaceRemoveRequest`,
      create: () => removeRequestSchema,
      jsonSchema: removeParamJsonSchema,
      description: "the combined workspace and the member names to drop."
    };
    var updateResultCodec = {
      mode: "strict",
      typeSymbol: `${PACKAGE_NAME}#WorkspaceUpdateResult`,
      create: () => updateResultSchema,
      jsonSchema: updateJsonSchema,
      description: "the combined workspace after the change."
    };
    function buildRemoteSpec() {
      return {
        package: PACKAGE_NAME,
        methods: {
          [LIST_ENDPOINT]: {
            service: NAMESPACE,
            description: "List one directory level for the in-app browser: absolute child directories only, name-sorted, with hidden flags and ancestry.",
            invocation: { kind: "direct" },
            parameters: [
              {
                name: "path",
                description: "absolute directory to list; null lists the home directory.",
                source: "json",
                codec: listPathCodec
              }
            ],
            result: listingResultCodec,
            sourceLocation: { file: "src/host/listing.ts", line: 1, column: 1 }
          },
          [PICK_ENDPOINT]: {
            service: NAMESPACE,
            description: "Open the native macOS folder panel with multiple selection enabled and return the picked absolute folder paths, or null when cancelled. A host without a local macOS display refuses and the Client opens the in-app browser instead.",
            invocation: { kind: "direct" },
            parameters: [
              {
                name: "message",
                description: "the prompt the native macOS folder panel shows.",
                source: "json",
                codec: pickMessageCodec
              }
            ],
            result: pickResultCodec,
            sourceLocation: { file: "src/host/native-picker.ts", line: 1, column: 1 }
          },
          [CREATE_ENDPOINT]: {
            service: NAMESPACE,
            description: 'Create one combined workspace from two or more folders: materialize a real directory under the dsh home, symlink every selected folder into it, and register the durable Workspace with the derived "A, B and C" title.',
            invocation: { kind: "direct" },
            parameters: [
              {
                name: "request",
                description: "the folders to link and an optional explicit title override.",
                source: "json",
                codec: requestCodec
              }
            ],
            result: resultCodec,
            sourceLocation: { file: "src/host/index.ts", line: 1, column: 1 }
          },
          [INSPECT_ENDPOINT]: {
            service: NAMESPACE,
            description: "Describe one combined workspace: its durable title, whether that title is still derived from the folders, and the symlinked members in order. Returns null when the directory holds no manifest.",
            invocation: { kind: "direct" },
            parameters: [
              {
                name: "request",
                description: "the combined-workspace directory to describe.",
                source: "json",
                codec: inspectParamCodec
              }
            ],
            result: inspectResultCodec,
            sourceLocation: { file: "src/host/index.ts", line: 1, column: 1 }
          },
          [ADD_ENDPOINT]: {
            service: NAMESPACE,
            description: "Append folders to an existing combined workspace: validate them, symlink them into the directory, rewrite the manifest, and recompute an automatic title. Removes the new links again when any step fails.",
            invocation: { kind: "direct" },
            parameters: [
              {
                name: "request",
                description: "the combined workspace and the folders to link into it.",
                source: "json",
                codec: addParamCodec
              }
            ],
            result: updateResultCodec,
            sourceLocation: { file: "src/host/index.ts", line: 1, column: 1 }
          },
          [REMOVE_ENDPOINT]: {
            service: NAMESPACE,
            description: "Remove folders from a combined workspace: drop their symlinks and manifest entries, never their directories, refuse to leave fewer than two members, and recompute an automatic title.",
            invocation: { kind: "direct" },
            parameters: [
              {
                name: "request",
                description: "the combined workspace and the member names to drop.",
                source: "json",
                codec: removeParamCodec
              }
            ],
            result: updateResultCodec,
            sourceLocation: { file: "src/host/index.ts", line: 1, column: 1 }
          }
        }
      };
    }

    // src/client/remote.ts
    var TYPERT_REMOTE = createTypertRemoteInfo(buildRemoteSpec(), import_zod3.z);

    // src/client/errors.ts
    var PICK_UNAVAILABLE_CODE = "multi-workspace/pick-unavailable";
    var RemoteCallError = class extends Error {
      /** Stable Host code, e.g. `multi-workspace/pick-unavailable`. */
      code;
      constructor(code, message) {
        super(message);
        this.name = "RemoteCallError";
        this.code = code;
      }
    };
    function isPickUnavailable(error) {
      return error instanceof RemoteCallError && error.code === PICK_UNAVAILABLE_CODE;
    }
    function messageOf(error) {
      return error instanceof Error ? error.message : String(error);
    }

    // src/client/flow.tsx
    var React2 = __toESM(require("react"), 1);

    // src/client/dialog.tsx
    var React = __toESM(require("react"), 1);
    var import_react_dom = require("react-dom");

    // src/shared/naming.ts
    var HARD_MAX_PATHS = 64;

    // src/client/selection.ts
    function selectionHas(selected, path) {
      return selected.some((entry) => entry.path === path);
    }
    function toggleSelection(selected, entry) {
      if (selectionHas(selected, entry.path)) {
        return selected.filter((candidate) => candidate.path !== entry.path);
      }
      if (selected.length >= HARD_MAX_PATHS) return selected;
      return [...selected, entry];
    }
    function removeSelection(selected, path) {
      return selected.filter((entry) => entry.path !== path);
    }
    function selectionPaths(selected) {
      return selected.map((entry) => entry.path);
    }

    // src/client/dialog.tsx
    var import_jsx_runtime = require("react/jsx-runtime");
    var panelStyles = {
      overlay: {
        position: "fixed",
        inset: 0,
        zIndex: 2e3,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0, 0, 0, 0.45)",
        padding: 16
      },
      panel: {
        display: "flex",
        flexDirection: "column",
        width: "min(620px, calc(100vw - 32px))",
        maxHeight: "min(78vh, 720px)",
        background: "var(--dsw-alias-bg-overlay, #ffffff)",
        color: "var(--dsw-alias-label-primary, #1f1f1f)",
        border: "1px solid var(--dsw-alias-border-l2, #d0d0d0)",
        borderRadius: 12,
        boxShadow: "0 18px 50px rgba(0, 0, 0, 0.35)",
        font: "inherit",
        outline: "none"
      },
      header: {
        padding: "16px 20px 0"
      },
      title: {
        margin: 0,
        fontSize: 16,
        fontWeight: 600
      },
      subtitle: {
        margin: "6px 0 0",
        fontSize: 12,
        lineHeight: 1.5,
        color: "var(--dsw-alias-label-secondary, #666)"
      },
      breadcrumb: {
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 2,
        padding: "10px 20px",
        borderBottom: "1px solid var(--dsw-alias-border-l1, #e5e5e5)",
        fontSize: 12,
        color: "var(--dsw-alias-label-secondary, #666)"
      },
      crumb: {
        border: "none",
        background: "transparent",
        color: "inherit",
        font: "inherit",
        padding: "2px 4px",
        borderRadius: 4,
        cursor: "pointer"
      },
      separator: {
        opacity: 0.5,
        padding: "0 2px"
      },
      controls: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "8px 20px",
        borderBottom: "1px solid var(--dsw-alias-border-l1, #e5e5e5)",
        fontSize: 12
      },
      hiddenToggle: {
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        cursor: "pointer",
        userSelect: "none"
      },
      refresh: {
        border: "1px solid var(--dsw-alias-border-l1, #ddd)",
        background: "transparent",
        color: "inherit",
        font: "inherit",
        padding: "3px 10px",
        borderRadius: 6,
        cursor: "pointer"
      },
      list: {
        flex: "1 1 auto",
        minHeight: 180,
        overflowY: "auto",
        padding: "6px 10px"
      },
      row: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "4px 8px",
        borderRadius: 6
      },
      checkbox: {
        margin: 0,
        cursor: "pointer",
        accentColor: "var(--dsw-alias-brand-primary, #3b82f6)"
      },
      name: {
        flex: "1 1 auto",
        minWidth: 0,
        textAlign: "left",
        border: "none",
        background: "transparent",
        color: "inherit",
        font: "inherit",
        fontSize: 13,
        padding: "4px 0",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        cursor: "pointer"
      },
      hiddenNote: {
        fontSize: 11,
        opacity: 0.6
      },
      status: {
        padding: "16px 12px",
        fontSize: 12,
        color: "var(--dsw-alias-label-secondary, #666)",
        textAlign: "center"
      },
      error: {
        margin: "8px 12px",
        padding: "8px 10px",
        fontSize: 12,
        color: "var(--dsw-alias-state-error-primary, #cc3344)",
        background: "var(--dsw-alias-bg-layer-2, #f7f7f7)",
        borderRadius: 6,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word"
      },
      selected: {
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 6,
        padding: "8px 20px",
        borderTop: "1px solid var(--dsw-alias-border-l1, #e5e5e5)",
        fontSize: 12
      },
      selectedLabel: {
        color: "var(--dsw-alias-label-secondary, #666)"
      },
      chip: {
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        maxWidth: "100%",
        padding: "2px 6px 2px 8px",
        border: "1px solid var(--dsw-alias-border-l1, #ddd)",
        borderRadius: 999,
        background: "var(--dsw-alias-bg-layer-2, #f5f5f5)"
      },
      chipName: {
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        maxWidth: 180
      },
      chipRemove: {
        border: "none",
        background: "transparent",
        color: "inherit",
        font: "inherit",
        lineHeight: 1,
        padding: "0 2px",
        cursor: "pointer",
        opacity: 0.75
      },
      footer: {
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 8,
        padding: "12px 20px 16px"
      },
      button: {
        border: "1px solid var(--dsw-alias-border-l1, #ddd)",
        background: "var(--dsw-alias-bg-layer-2, #f5f5f5)",
        color: "inherit",
        font: "inherit",
        fontSize: 13,
        padding: "7px 14px",
        borderRadius: 8,
        cursor: "pointer"
      },
      primary: {
        border: "1px solid transparent",
        background: "var(--dsw-alias-brand-primary, #3b82f6)",
        color: "#ffffff",
        font: "inherit",
        fontSize: 13,
        fontWeight: 500,
        padding: "7px 14px",
        borderRadius: 8,
        cursor: "pointer"
      },
      disabled: {
        opacity: 0.5,
        cursor: "not-allowed"
      },
      capNote: {
        color: "var(--dsw-alias-state-warn-primary, #a15c00)"
      }
    };
    function MultiFolderDialog(props) {
      const { list, t, busy, onConfirm, onCancel, overrides } = props;
      const excluded = React.useMemo(() => new Set(overrides?.exclude ?? []), [overrides]);
      const [listing, setListing] = React.useState(null);
      const [loading, setLoading] = React.useState(true);
      const [error, setError] = React.useState(null);
      const [showHidden, setShowHidden] = React.useState(false);
      const [selected, setSelected] = React.useState([]);
      const [submitting, setSubmitting] = React.useState(false);
      const request = React.useRef(0);
      const panel = React.useRef(null);
      const titleId = React.useId();
      const disabled = submitting || busy;
      const load = React.useCallback(
        async (path) => {
          const seq = request.current += 1;
          setLoading(true);
          setError(null);
          setListing(null);
          try {
            const next = await list(path ?? null);
            if (seq !== request.current) return;
            setListing(next);
          } catch (failure) {
            if (seq !== request.current) return;
            setError(messageOf(failure));
          } finally {
            if (seq === request.current) setLoading(false);
          }
        },
        [list]
      );
      React.useEffect(() => {
        void load();
      }, [load]);
      React.useEffect(() => {
        panel.current?.focus();
      }, []);
      React.useEffect(() => {
        const onKeyDown = (event) => {
          if (event.key === "Escape" && !disabled) {
            event.preventDefault();
            onCancel();
          }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
      }, [disabled, onCancel]);
      const visible = React.useMemo(
        () => listing === null ? [] : listing.entries.filter((entry) => showHidden || !entry.hidden),
        [listing, showHidden]
      );
      const toggle = (entry) => {
        if (disabled || excluded.has(entry.path)) return;
        setSelected((current2) => toggleSelection(current2, entry));
      };
      const confirm = async () => {
        if (disabled) return;
        const paths = selectionPaths(selected);
        if (paths.length === 0) return;
        setSubmitting(true);
        setError(null);
        try {
          await onConfirm(paths);
        } catch (failure) {
          setError(messageOf(failure));
          setSubmitting(false);
        }
      };
      if (typeof document === "undefined") return null;
      const confirmLabel = submitting ? t("dialog.creating") : overrides?.confirm !== void 0 ? overrides.confirm : selected.length === 1 ? t("dialog.open") : t("dialog.create");
      const crumbButtons = listing === null ? [] : listing.crumbs.filter((crumb) => crumb.path !== listing.home);
      return (0, import_react_dom.createPortal)(
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: panelStyles.overlay,
            onMouseDown: (event) => {
              if (event.target === event.currentTarget && !disabled) onCancel();
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
              "div",
              {
                ref: panel,
                role: "dialog",
                "aria-modal": "true",
                "aria-labelledby": titleId,
                tabIndex: -1,
                style: panelStyles.panel,
                onMouseDown: (event) => event.stopPropagation(),
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: panelStyles.header, children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { id: titleId, style: panelStyles.title, children: overrides?.title ?? t("dialog.title") }),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: panelStyles.subtitle, children: overrides?.subtitle ?? t("dialog.subtitle") })
                  ] }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: panelStyles.breadcrumb, children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                      "button",
                      {
                        type: "button",
                        style: panelStyles.crumb,
                        disabled,
                        onClick: () => void load(listing?.home),
                        children: t("dialog.home")
                      }
                    ),
                    crumbButtons.map((crumb) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(React.Fragment, { children: [
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: panelStyles.separator, children: "/" }),
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                        "button",
                        {
                          type: "button",
                          style: panelStyles.crumb,
                          disabled,
                          title: crumb.path,
                          onClick: () => void load(crumb.path),
                          children: crumb.path === listing?.crumbs[0]?.path ? t("dialog.root") : crumb.name
                        }
                      )
                    ] }, crumb.path))
                  ] }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: panelStyles.controls, children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { style: panelStyles.hiddenToggle, children: [
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                        "input",
                        {
                          type: "checkbox",
                          style: panelStyles.checkbox,
                          checked: showHidden,
                          disabled,
                          onChange: (event) => setShowHidden(event.currentTarget.checked)
                        }
                      ),
                      t("dialog.hidden")
                    ] }),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                      "button",
                      {
                        type: "button",
                        style: panelStyles.refresh,
                        disabled: disabled || loading,
                        onClick: () => void load(listing?.path),
                        children: t("dialog.refresh")
                      }
                    )
                  ] }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: panelStyles.list, children: [
                    loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: panelStyles.status, children: t("dialog.loading") }) : null,
                    error !== null ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { role: "alert", style: panelStyles.error, children: error }) : null,
                    !loading && error === null && visible.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: panelStyles.status, children: t("dialog.empty") }) : null,
                    !loading && error === null ? visible.map((entry) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: panelStyles.row, children: [
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                        "input",
                        {
                          type: "checkbox",
                          style: panelStyles.checkbox,
                          checked: selectionHas(selected, entry.path) || excluded.has(entry.path),
                          disabled: disabled || excluded.has(entry.path),
                          "aria-label": entry.name,
                          onChange: () => toggle(entry)
                        }
                      ),
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                        "button",
                        {
                          type: "button",
                          style: panelStyles.name,
                          disabled,
                          title: entry.path,
                          onClick: () => void load(entry.path),
                          children: entry.name
                        }
                      ),
                      excluded.has(entry.path) ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: panelStyles.hiddenNote, children: t("dialog.alreadyMember") }) : entry.hidden ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: panelStyles.hiddenNote, children: t("dialog.hiddenTag") }) : null
                    ] }, entry.path)) : null,
                    !loading && listing?.truncated === true ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: panelStyles.status, children: t("dialog.truncated") }) : null
                  ] }),
                  selected.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: panelStyles.selected, children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: panelStyles.selectedLabel, children: t("dialog.selected", { count: selected.length }) }),
                    selected.map((entry) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: panelStyles.chip, title: entry.path, children: [
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: panelStyles.chipName, children: entry.name }),
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                        "button",
                        {
                          type: "button",
                          style: panelStyles.chipRemove,
                          disabled,
                          "aria-label": t("dialog.remove", { name: entry.name }),
                          onClick: () => setSelected((current2) => removeSelection(current2, entry.path)),
                          children: "\xD7"
                        }
                      )
                    ] }, entry.path)),
                    selected.length >= HARD_MAX_PATHS ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: panelStyles.capNote, children: t("dialog.max") }) : null
                  ] }) : null,
                  /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: panelStyles.footer, children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", style: panelStyles.button, disabled, onClick: onCancel, children: t("dialog.cancel") }),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                      "button",
                      {
                        type: "button",
                        style: { ...panelStyles.primary, ...disabled || selected.length === 0 ? panelStyles.disabled : {} },
                        disabled: disabled || selected.length === 0,
                        onClick: () => void confirm(),
                        children: confirmLabel
                      }
                    )
                  ] })
                ]
              }
            )
          }
        ),
        document.body
      );
    }

    // src/client/flow.tsx
    var import_jsx_runtime2 = require("react/jsx-runtime");
    function MultiWorkspaceFlow(props) {
      const [phase, setPhase] = React2.useState("idle");
      const armed = React2.useRef(false);
      const alive = React2.useRef(true);
      const latest = React2.useRef(props);
      latest.current = props;
      React2.useEffect(() => {
        alive.current = true;
        return () => {
          alive.current = false;
        };
      }, []);
      React2.useEffect(() => {
        if (!props.open) {
          armed.current = false;
          setPhase("idle");
          return;
        }
        if (armed.current) return;
        armed.current = true;
        setPhase("checking");
        void (async () => {
          try {
            const paths = await props.pick(props.message);
            if (!alive.current) return;
            if (paths === null || paths.length === 0) {
              latest.current.onCancel();
              return;
            }
            const first = paths[0];
            if (paths.length === 1 && first !== void 0) {
              latest.current.onPicked(first);
              return;
            }
            const created = await props.createCombined(paths);
            if (!alive.current) return;
            latest.current.onPicked(created.path);
          } catch (error) {
            if (!alive.current) return;
            if (isPickUnavailable(error)) {
              setPhase("dialog");
              return;
            }
            latest.current.onError(messageOf(error));
            setPhase("idle");
          }
        })();
      }, [props.open, props.message, props.pick, props.createCombined]);
      if (!props.open || phase !== "dialog") return null;
      return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        MultiFolderDialog,
        {
          list: props.list,
          t: props.t,
          busy: props.busy,
          onCancel: () => {
            setPhase("idle");
            latest.current.onCancel();
          },
          onConfirm: async (paths) => {
            const first = paths[0];
            if (paths.length === 1 && first !== void 0) {
              latest.current.onPicked(first);
              return;
            }
            const created = await props.createCombined(paths);
            if (alive.current) latest.current.onPicked(created.path);
          }
        }
      );
    }

    // src/client/manage.tsx
    var React4 = __toESM(require("react"), 1);
    var import_react_dom2 = require("react-dom");

    // src/client/requests.ts
    var React3 = __toESM(require("react"), 1);
    var current = null;
    var listeners = /* @__PURE__ */ new Set();
    function openFoldersRequest(request) {
      current = request;
      for (const listener of listeners) listener();
    }
    function closeFoldersRequest() {
      if (current === null) return;
      current = null;
      for (const listener of listeners) listener();
    }
    function useFoldersRequest() {
      return React3.useSyncExternalStore(
        (listener) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        () => current,
        () => current
      );
    }

    // src/client/manage.tsx
    var import_jsx_runtime3 = require("react/jsx-runtime");
    function FoldersSurface(props) {
      const request = useFoldersRequest();
      if (request === null) return null;
      return request.kind === "add" ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(AppendSurface, { request, ...props }, `add:${request.path}`) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(RemoveSurface, { request, ...props }, `remove:${request.path}`);
    }
    function AppendSurface(props) {
      const { t, message, pick, list, addFolders, request } = props;
      const [phase, setPhase] = React4.useState("native");
      const [error, setError] = React4.useState(null);
      const [busy, setBusy] = React4.useState(false);
      const started = React4.useRef(false);
      const alive = React4.useRef(true);
      React4.useEffect(() => {
        alive.current = true;
        return () => {
          alive.current = false;
        };
      }, []);
      const append = React4.useCallback(
        async (paths) => {
          setBusy(true);
          setError(null);
          try {
            await addFolders(request.path, paths);
            closeFoldersRequest();
          } catch (failure) {
            setError(messageOf(failure));
            setBusy(false);
            setPhase("failed");
          }
        },
        [addFolders, request.path]
      );
      React4.useEffect(() => {
        if (started.current) return;
        started.current = true;
        void (async () => {
          try {
            const paths = await pick(message);
            if (!alive.current) return;
            if (paths === null || paths.length === 0) {
              closeFoldersRequest();
              return;
            }
            await append(paths);
          } catch (failure) {
            if (!alive.current) return;
            if (isPickUnavailable(failure)) {
              setPhase("browser");
              return;
            }
            setError(messageOf(failure));
            setPhase("failed");
          }
        })();
      }, [append, message, pick]);
      if (phase === "idle" || phase === "native") return null;
      if (phase === "failed") {
        return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Notice, { title: t("manage.add.title"), error, t });
      }
      return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        MultiFolderDialog,
        {
          list,
          t,
          busy,
          onCancel: closeFoldersRequest,
          onConfirm: async (paths) => {
            await append(paths);
          },
          overrides: {
            title: t("manage.add.title", { name: request.title }),
            subtitle: t("manage.add.subtitle"),
            confirm: busy ? t("manage.add.pending") : t("manage.add.confirm"),
            exclude: request.members.map((member) => member.target)
          }
        }
      );
    }
    function RemoveSurface(props) {
      const { t, removeFolders, request } = props;
      const [chosen, setChosen] = React4.useState([]);
      const [busy, setBusy] = React4.useState(false);
      const [error, setError] = React4.useState(null);
      const remaining = request.members.length - chosen.length;
      const blocked = busy || chosen.length === 0 || remaining < MIN_MEMBERS;
      const titleId = React4.useId();
      const toggle = (name) => {
        if (busy) return;
        setChosen((current2) => current2.includes(name) ? current2.filter((entry) => entry !== name) : [...current2, name]);
      };
      const confirm = async () => {
        if (blocked) return;
        setBusy(true);
        setError(null);
        try {
          await removeFolders(request.path, chosen);
          closeFoldersRequest();
        } catch (failure) {
          setError(messageOf(failure));
          setBusy(false);
        }
      };
      if (typeof document === "undefined") return null;
      return (0, import_react_dom2.createPortal)(
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: panelStyles.overlay, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { role: "dialog", "aria-modal": "true", "aria-labelledby": titleId, style: panelStyles.panel, children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: panelStyles.header, children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("h2", { id: titleId, style: panelStyles.title, children: t("manage.remove.title", { name: request.title }) }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { style: panelStyles.subtitle, children: t("manage.remove.subtitle") })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: panelStyles.list, children: request.members.map((member) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("label", { style: { ...panelStyles.row, cursor: busy ? "default" : "pointer" }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
              "input",
              {
                type: "checkbox",
                style: panelStyles.checkbox,
                checked: chosen.includes(member.name),
                disabled: busy,
                onChange: () => toggle(member.name)
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { ...panelStyles.name, overflow: "hidden", textOverflow: "ellipsis" }, children: member.name }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { ...panelStyles.hiddenNote, maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, title: member.target, children: member.target })
          ] }, member.name)) }),
          remaining < MIN_MEMBERS ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { role: "alert", style: panelStyles.error, children: t("manage.remove.minimum", { count: MIN_MEMBERS }) }) : null,
          error !== null ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { role: "alert", style: panelStyles.error, children: error }) : null,
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: panelStyles.footer, children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", style: panelStyles.button, disabled: busy, onClick: closeFoldersRequest, children: t("manage.cancel") }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
              "button",
              {
                type: "button",
                style: { ...panelStyles.primary, ...blocked ? panelStyles.disabled : {} },
                disabled: blocked,
                onClick: () => void confirm(),
                children: busy ? t("manage.remove.pending") : t("manage.remove.confirm")
              }
            )
          ] })
        ] }) }),
        document.body
      );
    }
    function Notice(props) {
      const { title, error, t } = props;
      const titleId = React4.useId();
      if (typeof document === "undefined") return null;
      return (0, import_react_dom2.createPortal)(
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: panelStyles.overlay, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { role: "dialog", "aria-modal": "true", "aria-labelledby": titleId, style: panelStyles.panel, children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: panelStyles.header, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("h2", { id: titleId, style: panelStyles.title, children: title }) }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { role: "alert", style: panelStyles.error, children: error ?? t("manage.failed") }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: panelStyles.footer, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", style: panelStyles.primary, onClick: closeFoldersRequest, children: t("manage.close") }) })
        ] }) }),
        document.body
      );
    }

    // src/client/index.ts
    var inject = ["slots", "locale", "remote", "contextMenus"];
    async function unwrap(call) {
      const result = await call();
      if (result.ok) return result.value;
      throw new RemoteCallError(result.error.code, result.error.message);
    }
    async function apply(context) {
      const ctx = context;
      const disposeRemote = await ctx.remote.$mount(TYPERT_REMOTE);
      const disposeLocale = ctx.effect(() => {
        const disposers = [];
        try {
          disposers.push(ctx.locale.register(NS, "zh", zh));
          disposers.push(ctx.locale.register(NS, "en", en));
        } catch (error) {
          for (const dispose of disposers.reverse()) dispose();
          throw error;
        }
        return () => {
          for (const dispose of disposers.reverse()) dispose();
        };
      }, "multi-workspace: picker dictionaries");
      const translate = ctx.locale.bind(NS);
      const message = translate("picker.message");
      const namespace = () => {
        const service = ctx.get("remote.multiWorkspace");
        if (service === void 0) throw new Error("multiWorkspace Remote namespace is unavailable");
        return service;
      };
      const pick = (prompt) => unwrap(() => namespace().pick(prompt));
      const list = (path) => unwrap(() => namespace().list(path));
      const createCombined = (paths) => unwrap(() => namespace().create({ paths: [...paths] }));
      const inspect = (path) => unwrap(() => namespace().inspect({ path }));
      const addFolders = (path, paths) => unwrap(() => namespace().addFolders({ path, paths: [...paths] }));
      const removeFolders = (path, names) => unwrap(() => namespace().removeFolders({ path, names: [...names] }));
      const injected = () => ({
        pick,
        list,
        createCombined,
        message,
        t: translate
      });
      const surfaceInjected = () => ({
        t: translate,
        message: translate("manage.pickMessage"),
        pick,
        list,
        addFolders,
        removeFolders
      });
      const disposeSlots = ctx.effect(
        () => ctx.slots.inject(
          "conversation.hero.workspace.directoryFlow",
          () => ctx.slots.inject("sidebar.workspaces.directoryFlow", function* () {
            yield ctx.slots.register(
              { name: "conversation.hero.workspace.directoryFlow", inject: injected },
              MultiWorkspaceFlow
            );
            yield ctx.slots.register(
              { name: "sidebar.workspaces.directoryFlow", inject: injected },
              MultiWorkspaceFlow
            );
          })
        ),
        "multi-workspace: directory-flow occupants"
      );
      const disposeMenu = ctx.effect(
        () => ctx.contextMenus.register({
          id: "multi-workspace.folders",
          target: "workspace",
          order: 120,
          resolve: async (target) => {
            let info;
            try {
              info = await inspect(target.path);
            } catch {
              return [];
            }
            if (info === null) return [];
            const rows = [];
            if (info.members.length < HARD_MAX_PATHS) {
              rows.push({
                id: "add-folders",
                label: translate("menu.add"),
                run: () => {
                  openFoldersRequest({ kind: "add", path: info.path, title: info.title, members: info.members });
                }
              });
            }
            if (info.members.length > MIN_MEMBERS) {
              rows.push({
                id: "remove-folders",
                label: translate("menu.remove"),
                run: () => {
                  openFoldersRequest({
                    kind: "remove",
                    path: info.path,
                    title: info.title,
                    members: info.members
                  });
                }
              });
            }
            return rows;
          }
        }),
        "multi-workspace: workspace menu rows"
      );
      const disposeSurface = ctx.effect(
        () => ctx.slots.inject(
          "shell.overlay",
          () => ctx.slots.register(
            { name: "shell.overlay", id: "multi-workspace.folders", inject: surfaceInjected },
            FoldersSurface
          )
        ),
        "multi-workspace: folders surface"
      );
      return async () => {
        disposeSurface();
        disposeMenu();
        disposeSlots();
        disposeLocale();
        await disposeRemote();
      };
    }

    return module.exports;
  },
});
