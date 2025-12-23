import { GoogleGenerativeAI } from '@google/generative-ai';
import { ChatMessage } from '../models/ChatMessage';
import { ChoreWithStatus } from '../models/Chore';
import { classifyComplexity, getModelName, ModelComplexity } from '../llm/modelRouter';
import { formatMessagesForGemini } from '../llm/contextBuilder';
import { buildSystemPrompt } from '../llm/prompts';
import { logger } from '../utils/logger';

export class GeminiService {
  private genAI: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async chat(
    message: string,
    history: ChatMessage[],
    chores: ChoreWithStatus[],
    explicitComplexity?: ModelComplexity
  ): Promise<{ response: string; modelUsed: string }> {
    const complexity = explicitComplexity || classifyComplexity(message, history);
    const modelName = getModelName(complexity);

    logger.info(
      `Processing message with ${modelName} (complexity: ${complexity}, length: ${message.length})`
    );

    const model = this.genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: buildSystemPrompt(chores),
    });

    const formattedHistory = formatMessagesForGemini(history);

    const chat = model.startChat({
      history: formattedHistory,
    });

    try {
      const result = await chat.sendMessage(message);
      const responseText = result.response.text();

      logger.info(`Received response from ${modelName} (length: ${responseText.length})`);

      return {
        response: responseText,
        modelUsed: modelName,
      };
    } catch (error) {
      logger.error(`Error calling Gemini API: ${error}`);

      if (complexity === 'simple') {
        logger.warn('Falling back to complex model after simple model failure');
        return this.chat(message, history, chores, 'complex');
      }

      throw new Error(
        `Failed to get response from Gemini: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async generateResponse(prompt: string, modelComplexity: ModelComplexity = 'simple'): Promise<string> {
    const modelName = getModelName(modelComplexity);
    const model = this.genAI.getGenerativeModel({ model: modelName });

    try {
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      logger.error(`Error generating content with ${modelName}: ${error}`);
      throw new Error(
        `Failed to generate content: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
