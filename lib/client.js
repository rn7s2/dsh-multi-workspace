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
    var React = __toESM(require("react"), 1);

    // src/client/locale.ts
    var NS = "multi-workspace";
    var zh = {
      "picker.message": "\u9009\u62E9\u6587\u4EF6\u5939\uFF08\u53EF\u591A\u9009\uFF1A\u9009 2 \u4E2A\u53CA\u4EE5\u4E0A\u4F1A\u521B\u5EFA\u7EC4\u5408\u5DE5\u4F5C\u533A\uFF09"
    };
    var en = {
      "picker.message": "Choose folders (select 2 or more to create a combined workspace)"
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
      workspaceId: import_zod.z.string().min(1),
      created: import_zod.z.boolean(),
      links: import_zod.z.array(zLink),
      sources: import_zod.z.array(import_zod.z.string().min(1))
    });
    var pickMessageSchema = import_zod.z.string().min(1).max(200);
    var pickResultSchema = import_zod.z.union([import_zod.z.null(), import_zod.z.array(import_zod.z.string().min(1))]);

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
      required: ["path", "title", "workspaceId", "created", "links", "sources"],
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
    function buildRemoteSpec() {
      return {
        package: PACKAGE_NAME,
        methods: {
          [PICK_ENDPOINT]: {
            service: NAMESPACE,
            description: "Open the native macOS folder panel with multiple selection enabled and return the picked absolute folder paths, or null when cancelled. Only macOS is supported for now.",
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
          }
        }
      };
    }

    // src/client/remote.ts
    var TYPERT_REMOTE = createTypertRemoteInfo(buildRemoteSpec(), import_zod3.z);

    // src/client/index.ts
    var inject = ["slots", "locale", "remote"];
    function MultiWorkspaceFlow(props) {
      const armed = React.useRef(false);
      const outcome = React.useRef(props);
      outcome.current = props;
      const alive = React.useRef(true);
      React.useEffect(() => {
        alive.current = true;
        return () => {
          alive.current = false;
        };
      }, []);
      React.useEffect(() => {
        if (!props.open) {
          armed.current = false;
          return;
        }
        if (armed.current) return;
        armed.current = true;
        void (async () => {
          try {
            const paths = await props.pick(props.message);
            if (!alive.current) return;
            if (paths === null || paths.length === 0) {
              outcome.current.onCancel();
              return;
            }
            const first = paths[0];
            if (paths.length === 1 && first !== void 0) {
              outcome.current.onPicked(first);
              return;
            }
            const created = await props.createCombined(paths);
            if (!alive.current) return;
            outcome.current.onPicked(created.path);
          } catch (error) {
            if (!alive.current) return;
            outcome.current.onError(error instanceof Error ? error.message : String(error));
          }
        })();
      }, [props.open, props.message, props.pick, props.createCombined]);
      return null;
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
      }, "multi-workspace: native picker dictionary");
      const message = ctx.locale.bind(NS)("picker.message");
      const namespace = () => {
        const service = ctx.get("remote.multiWorkspace");
        if (service === void 0) throw new Error("multiWorkspace Remote namespace is unavailable");
        return service;
      };
      const pick = async (prompt) => {
        const result = await namespace().pick(prompt);
        if (result.ok) return result.value;
        throw new Error(result.error.message);
      };
      const createCombined = async (paths) => {
        const result = await namespace().create({ paths: [...paths] });
        if (result.ok) return result.value;
        throw new Error(result.error.message);
      };
      const injected = () => ({ pick, createCombined, message });
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
      return async () => {
        disposeSlots();
        disposeLocale();
        await disposeRemote();
      };
    }

    return module.exports;
  },
});
