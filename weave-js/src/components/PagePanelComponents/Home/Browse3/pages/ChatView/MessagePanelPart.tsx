import 'prismjs/components/prism-markup-templating';

import _ from 'lodash';
import React from 'react';

import {TargetBlank} from '../../../../../../common/util/links';
import {CodeEditor} from '../../../../../CodeEditor';
import {ToolCalls} from './ToolCalls';
import {MessagePart, ToolCall} from './types';

type MessagePanelPartProps = {
  value: MessagePart;
  isStructuredOutput?: boolean;
  showCursor?: boolean;
};

export const MessagePanelPart = ({
  value,
  isStructuredOutput,
  showCursor = false,
}: MessagePanelPartProps) => {
  if (typeof value === 'string') {
    if (isStructuredOutput) {
      const reformat = JSON.stringify(JSON.parse(value), null, 2);
      return <CodeEditor language="json" value={reformat} />;
    }
    // Markdown is slowing down chat view, disable for now
    // Bring back if we can find a faster way to render markdown
    // if (isLikelyMarkdown(value)) {
    //   return <Markdown content={value} />;
    // }
    return (
      <>
        <style>
          {`
            @keyframes blink {
              0%, 100% { opacity: 1; }
              50% { opacity: 0; }
            }
            .cursor-blink {
              animation: blink 1s ease-in-out infinite;
            }
          `}
        </style>
        <div>
          <span className="whitespace-break-spaces">{value}</span>
          {showCursor && (
            <span className="cursor-blink -mb-[2px] ml-[4px] inline-block h-[12px] w-[12px] rounded-full bg-gold-500" />
          )}
        </div>
      </>
    );
  }
  if (value.type === 'text' && 'text' in value) {
    return <div className="whitespace-break-spaces">{value.text}</div>;
  }
  if (value.type === 'image_url' && 'image_url' in value && value.image_url) {
    const {url} = value.image_url;
    return (
      <div>
        {!url.startsWith('data:') && (
          <div className="text-xs">
            <TargetBlank href={url}>{url}</TargetBlank>
          </div>
        )}
        <div>
          <img src={url} alt="" />
        </div>
      </div>
    );
  }
  if (value.type === 'tool_use' && 'name' in value && 'id' in value) {
    const toolCall: ToolCall = {
      id: value.id || '',
      type: value.type,
      function: {
        name: value.name || '',
        arguments: JSON.stringify(value.input) || '',
      },
    };
    return <ToolCalls toolCalls={[toolCall]} />;
  }

  if (value.type === 'tool_result' && 'content' in value) {
    // value.content can be a string or an array of content blocks
    const contentArray = Array.isArray(value.content)
      ? value.content
      : [value.content];
    return (
      <>
        {contentArray.map(content => {
          const stringContent =
            _.isObject(content) && 'text' in content ? content.text : content;
          try {
            const jsonContent = JSON.stringify(
              JSON.parse(stringContent as string),
              null,
              2
            );
            return <CodeEditor language="json" value={jsonContent} readOnly />;
          } catch (error) {
            return (
              <span className="whitespace-break-spaces">{stringContent}</span>
            );
          }
        })}
      </>
    );
  }
  return null;
};
