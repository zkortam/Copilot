import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './styles.less'; // Ensure styles for the pill are included
import { Context, ResponseData } from '@incorta-org/component-sdk';

interface ChatMessage {
  sender: 'user' | 'ai';
  text: string;
  isCrafting?: boolean; // Indicates if the message is in crafting mode
}

interface CopilotProps {
  context: Context<any>; // The Incorta context
  data: ResponseData; // Data provided by the tray
}

const Copilot: React.FC<CopilotProps> = ({ context, data }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [trayData, setTrayData] = useState<string>(''); // State to store formatted tray data
  const [initialized, setInitialized] = useState(false); // Tracks if tray data has been included
  const [isGenerating, setIsGenerating] = useState(false); // Tracks if AI is generating a response
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null); // Tracks hovered bubble
  const [showLoadingPill, setShowLoadingPill] = useState(true); // Controls visibility of loading pill

  const hiddenPromptAddition = `Answer the user's prompt directly and concisely. Avoid unnecessary details. Always follow these rules. Do not mention the data I give until the user asks.`; // Hidden developer addition

  const processTrayData = (): string => {
    const trayBindings = context?.component?.bindings?.['tray-key'];
    if (!trayBindings || trayBindings.length === 0) {
      return ''; // Return an empty string if no tray data is present
    }

    const processedData = trayBindings.map((binding, index) => {
      const bindingData = data?.data?.map((row) => row[index]?.value) || [];
      const header = data?.measureHeaders[index]?.label || `Column ${index + 1}`;

      return {
        label: header,
        values: bindingData,
      };
    });

    return JSON.stringify(processedData, null, 2); // Pretty-print the tray data
  };

  // Initialize GPT with hidden tray data
  useEffect(() => {
    const processedData = processTrayData();
    setTrayData(processedData); // Save processed tray data for context

    const initializeGPT = async () => {
      if (initialized || !processedData) return;

      const initialPrompt = `Here is the tray data to remember:\n${processedData}\n\n${hiddenPromptAddition}`;

      try {
        const response = await axios.post(
          'https://api.openai.com/v1/chat/completions',
          {
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: initialPrompt }],
          },
          {
            headers: {
              Authorization: `Bearer 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`,
              'Content-Type': 'application/json',
            },
          }
        );
        console.log('GPT Initialized with Tray Data:', response.data.choices[0].message.content);
        setInitialized(true);
      } catch (error) {
        console.error('Error initializing GPT with tray data:', error);
      }
    };

    initializeGPT();

    // Show the loading pill for 3 seconds
    const timer = setTimeout(() => {
      setShowLoadingPill(false); // Hide the loading pill after 3 seconds
    }, 3000);

    return () => clearTimeout(timer); // Cleanup timer on component unmount
  }, [context, data, initialized]);

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: ChatMessage = { sender: 'user', text: input };
    setMessages([...messages, userMessage]);
    setInput(''); // Clear the input field

    const craftingMessage: ChatMessage = { sender: 'ai', text: '', isCrafting: true };
    setMessages((prevMessages) => [...prevMessages, craftingMessage]);
    setIsGenerating(true); // Start generating animation

    try {
      const formattedMessages: { role: string; content: string }[] = [
        { role: 'user', content: `Here is the tray data to remember:\n${trayData}\n\n${hiddenPromptAddition}` },
        ...messages.map((msg) => ({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.text,
        })),
        { role: 'user', content: input },
      ];

      console.log('Formatted Messages Sent to GPT:', formattedMessages);

      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4',
          messages: formattedMessages,
        },
        {
          headers: {
            Authorization: `Bearer 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`,
            'Content-Type': 'application/json',
          },
        }
      );

      const gptResponse = response.data.choices[0].message.content;
      const aiMessage: ChatMessage = { sender: 'ai', text: gptResponse };
      setMessages((prevMessages) => [...prevMessages.slice(0, -1), aiMessage]); // Replace crafting message
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: ChatMessage = {
        sender: 'ai',
        text: 'Sorry, something went wrong.',
      };
      setMessages((prevMessages) => [...prevMessages.slice(0, -1), errorMessage]); // Replace crafting message
    } finally {
      setIsGenerating(false); // Stop generating animation
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(
      () => console.log('Copied to clipboard:', text),
      (err) => console.error('Failed to copy text:', err)
    );
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleSendMessage();
    }
  };

  return (
    <div className="copilot-container">
      {showLoadingPill && (
        <div className="loading-pill">
          Loading Tray Data
        </div>
      )}
      <div className="copilot-history">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`message ${message.sender} ${message.isCrafting ? 'crafting' : ''}`}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
            style={{
              position: 'relative',
              opacity: message.isCrafting ? 0.7 : 1,
              transition: 'opacity 0.25s ease-in',
              marginBottom: '20px',
            }}
          >
            {message.isCrafting ? '' : message.text}
            {hoveredIndex === index && (
              <button
                className="copy-button"
                onClick={() => copyToClipboard(message.text)}
                style={{
                  position: 'absolute',
                  top: '100%',
                  marginTop: '10px',
                  right: message.sender === 'ai' ? '10px' : 'auto',
                  left: message.sender === 'user' ? '10px' : 'auto',
                  backgroundColor: 'transparent',
                  color: 'darkgray',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                Copy
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="copilot-input">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Message Copilot"
        />
        <button
          onClick={handleSendMessage}
          className={`submit-button ${isGenerating ? 'generating' : ''}`}
        >
          {!isGenerating ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              height="150px"
              width="150px"
              viewBox="0 -960 960 960"
              fill="#e8eaed"
            >
              <path d="M452-244v-400L282-477l-42-43 241-241 241 241-42 42-168-168v402h-60Z" />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="rotating"
              viewBox="0 -960 960 960"
              fill="#e8eaed"
            >
              <path d="M480-80q-82 0-155-31.5t-127.5-86Q143-252 111.5-325T80-480q0-83 31.5-155.5t86-127Q252-817 325-848.5T480-880q17 0 28.5 11.5T520-840q0 17-11.5 28.5T480-800q-133 0-226.5 93.5T160-480q0 133 93.5 226.5T480-160q133 0 226.5-93.5T800-480q0-17 11.5-28.5T840-520q17 0 28.5 11.5T880-480q0 82-31.5 155t-86 127.5q-54.5 54.5-127 86T480-80Z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
};

export default Copilot;