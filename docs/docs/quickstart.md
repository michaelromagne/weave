import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Track LLM inputs & outputs

:::tip
For a limited time, the new W&B Inference service is included in your free tier. W&B Inference provides access to leading open-source foundation models via API and the Weave [Playground](./guides/tools/playground.md). 
- [Developer documentation](./guides/integrations/inference.md)
- [Product page](https://wandb.ai/site/inference) 
:::

<!-- TODO: Update wandb.me/weave-quickstart to match this new link -->

Follow these steps to track your first call or <a class="vertical-align-colab-button" target="_blank" href="http://wandb.me/weave_colab"><img src="https://colab.research.google.com/assets/colab-badge.svg" alt="Open In Colab"/></a>

## 1. Install Weave and create an API Key

**Install weave**

First install the weave library:

<Tabs groupId="programming-language" queryString>
  <TabItem value="python" label="Python" default>
    ```bash
    pip install weave
    ```
  </TabItem>
  <TabItem value="typescript" label="TypeScript">
    ```bash
    pnpm install weave
    ```
  </TabItem>
</Tabs>

**Get your API key**

Then, create a Weights & Biases (W&B) account at https://wandb.ai and copy your API key from https://wandb.ai/authorize

## 2. Log a trace to a new project

To get started with tracking your first project with Weave:

- Import the `weave` library
- Call `weave.init('project-name')` to start tracking
  - You will be prompted to log in with your API key if you are not yet logged in on your machine.
  - To log to a specific W&B Team name, replace `project-name` with `team-name/project-name`
  - **NOTE:** In automated environments, you can define the environment variable `WANDB_API_KEY` with your API key to login without prompting.
- Add the `@weave.op()` decorator to the python functions you want to track

_In this example, we're using openai so you will need to add an OpenAI [API key](https://platform.openai.com/docs/quickstart/step-2-setup-your-api-key)._

<Tabs groupId="programming-language" queryString>
  <TabItem value="python" label="Python" default>
    ```python
    # highlight-next-line
    import weave
    from openai import OpenAI

    client = OpenAI()

    # Weave will track the inputs, outputs and code of this function
    # highlight-next-line
    @weave.op()
    def extract_dinos(sentence: str) -> dict:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "system",
                    "content": """In JSON format extract a list of `dinosaurs`, with their `name`,
    their `common_name`, and whether its `diet` is a herbivore or carnivore"""
                },
                {
                    "role": "user",
                    "content": sentence
                }
                ],
                response_format={ "type": "json_object" }
            )
        return response.choices[0].message.content


    # Initialise the weave project
    # highlight-next-line
    weave.init('jurassic-park')

    sentence = """I watched as a Tyrannosaurus rex (T. rex) chased after a Triceratops (Trike), \
    both carnivore and herbivore locked in an ancient dance. Meanwhile, a gentle giant \
    Brachiosaurus (Brachi) calmly munched on treetops, blissfully unaware of the chaos below."""

    result = extract_dinos(sentence)
    print(result)
    ```
    When you call the `extract_dinos` function Weave will output a link to view your trace.

  </TabItem>
  <TabItem value="typescript" label="TypeScript">
    ```typescript
    import OpenAI from 'openai';
    // highlight-next-line
    import * as weave from 'weave';
    
    // highlight-next-line
    const openai = new OpenAI();
  
    async function extractDinos(input: string) {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: `In JSON format extract a list of 'dinosaurs', with their 'name', their 'common_name', and whether its 'diet' is a herbivore or carnivore: ${input}`,
          },
        ],
      });
      return response.choices[0].message.content;
    }
    // highlight-next-line
    const extractDinosOp = weave.op(extractDinos);

    async function main() {
      // highlight-next-line
      await weave.init('examples');
      const result = await extractDinosOp(
        'I watched as a Tyrannosaurus rex (T. rex) chased after a Triceratops (Trike), both carnivore and herbivore locked in an ancient dance. Meanwhile, a gentle giant Brachiosaurus (Brachi) calmly munched on treetops, blissfully unaware of the chaos below.'
      );
      console.log(result);
    }

    main();

    ```
    When you call the `extractDinos` function Weave will output a link to view your trace.

  </TabItem>
</Tabs>

## 3. Automated LLM library logging

Calls made to OpenAI, Anthropic and [many more LLM libraries](./guides/integrations/index.md) are automatically tracked with Weave, with **LLM metadata**, **token usage** and **cost** being logged automatically. If your LLM library isn't currently one of our integrations you can track calls to other LLMs libraries or frameworks easily by wrapping them with `@weave.op()`.

## 4. See traces of your application in your project

🎉 Congrats! Now, every time you call this function, weave will automatically capture the input & output data and log any changes made to the code.

![Weave Trace Outputs 1](../static/img/tutorial_trace_1.png)

## What's next?

- Follow the [Tracking flows and app metadata](/tutorial-tracing_2) to start tracking and the data flowing through your app.
