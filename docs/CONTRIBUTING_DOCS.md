# Contributing to Weave Documentation

## Guidelines

- Ensure tone and style is consistent with existing documentation.
- Ensure that the `sidebar.ts` file is updated if adding new pages

## Installation

Satisfy the following dependencies to create, build, and locally serve Weave Docs on your local machine:

- (Recommended) Install [`nvm`](https://github.com/nvm-sh/nvm) to manage your node.js versions.
- Install [Node.js](https://nodejs.org/en/download/) version 18.0.0.
  ```node
  nvm install 18.0.0
  ```
- Install Yarn. It is recommended to install Yarn through the [npm package manager](http://npmjs.org/), which comes bundled with [Node.js](https://nodejs.org/) when you install it on your system.
  ```yarn
  npm install --global yarn
  ```
- Make sure your python environment is setup by running the following from the repro root:
  - `pip install -r requirements.dev.txt`
  - `pip install -e .`
- Run `playwright install`
- Install an IDE (e.g. VS Code) or Text Editor (e.g. Sublime)

&nbsp;

Build and run the docs locally to test that all edits, links etc are working. After you have forked and cloned wandb/weave:

```
cd docs

yarn install
```

Then test that you can build and run the docs locally:

```
yarn start
```

This will return the port number where you can preview your changes to the docs.

## How to edit the docs locally

1. Navigate to your local GitHub repo of `weave` and pull the latest changes from master:

```bash
cd docs
git pull origin main
```

2. Create a feature branch off of `main`.

```bash
git checkout -b <your-feature-branch>
```

3. In a new terminal, start a local preview of the docs with `yarn start`.

```bash
yarn start
```

This will return the port number where you can preview your changes to the docs.

4. Make your changes on the new branch.
5. Check your changes are rendered correctly.

6. Commit the changes to the branch.

```bash
git commit -m 'chore(docs): Useful commit message.'
```

7. Push the branch to GitHub.

```bash
git push origin <your-feature-branch>
```

8. Open a pull request from the new branch to the original repo.

## DocGen

Currently, we have 3 forms of doc generation:

1. Python Doc Gen
2. Service Doc Gen
3. Notebook Doc Gen

Assuming you have node and python packages installed, these can all be generated by running `make generate_reference_docs`.

Let's review some details about each process:

### Python Doc Gen

See: `docs/scripts/generate_python_sdk_docs.py` and `./docs/reference/python-sdk`

Python doc gen uses `lazydocs` as the core library for building markdown docs from our symbols. There are a few things to keep in mind:

1. `docs/scripts/generate_python_sdk_docs.py` contains an allow-list of modules to document. Since the Weave codebase is massive, it is far easier to just select what modules are useful for docs.
2. If the file does now have a `__docspec__` list of symbols, all non-underscore symbols will be documented. However, if it does have a `__docspec__`, that will further narrow the symbols to just that selection.
3. Documentation itself:
   1. Module-level: Put a triple double quote (""") comment as the first line of the module to add module-level documentation
   2. Classes: Put a triple double quote (""") comment as the first line of the class to add class-level docs
   3. Methods / Functions: Put a triple double quote (""") comment as the first line of the implementation to add method/function-level docs
      1. Currently attributes are not automatically documented. Instead, use the @property pattern.
      2. `BaseModel`. For classes that inherit from `BaseModel`, we create a special field list automatically to overcome this limitation.

### Service Doc Gen

See `docs/scripts/generate_service_api_spec.py` and `./docs/reference/service-api`

Service doc generation loads the `openapi.json` file describing the server, processes it, then uses the `docusaurus-plugin-openapi-docs` plugin to generate markdown files from that specification.

To improve docs, basically follow FastAPI's instructions to create good Swagger docs by adding field-level and endpoint-level documentation using their APIs. Assuming you have made some changes, `docs/scripts/generate_service_api_spec.py` needs a server to point to. You can either deploy to prod, or run the server locally and point to it in `docs/scripts/generate_service_api_spec.py`. From there, `docs/scripts/generate_service_api_spec.py` will download the spec, clean it up, and build the docs!

### Notebook Doc Gen

Summary: Use `docs/scripts/generate_notebooks.py` to convert Jupyter notebooks (`.ipynb`) in  `./docs/notebooks` to Markdown files in `./docs/reference/gen_notebooks`.

This script converts Jupyter notebooks (`.ipynb`) into Markdown files that can be referenced by Docusaurus just like any other `.md` doc. By default, it loads all notebooks in `./docs/notebooks` and writes the converted Markdown to `./docs/reference/gen_notebooks`.

To run the default export for all notebooks:

```bash
python docs/scripts/generate_notebooks.py
```

To convert a single notebook:

```bash
python docs/scripts/generate_notebooks.py path/to/your_notebook.ipynb
```

This will generate a Markdown file with the same base name in `./docs/reference/gen_notebooks`.

If your notebook requires Docusaurus header metadata, you can include a special markdown block at the top of a markdown cell in your notebook:

```
<!-- docusaurus_head_meta::start
---
title: Head Metadata
---
docusaurus_head_meta::end -->
```

### Playground Model List Sync

The [playground model list in `playground.md`](https://weave-docs.wandb.ai/guides/tools/playground#select-an-llm) is generated via `update_playground_models.py`.

To run this update manually:

```bash
make update_playground_models
```

This will regenerate the model list and update the appropriate section in `playground.md`. You don’t need to manually edit that section.
