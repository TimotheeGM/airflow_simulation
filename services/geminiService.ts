import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, PhysicsResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Acts as an Expert Aerodynamicist explaining the scientifically calculated data.
 */
export const explainSimulation = async (
  physicsData: PhysicsResult,
  shapeType: string,
  alpha: number
): Promise<Pick<AnalysisResult, 'explanation' | 'recommendations'>> => {
  try {
    const prompt = `
      You are an expert Aerodynamicist consultant.
      We have run a scientific Panel Method simulation (Vortex Lattice) on a ${shapeType}.
      
      Calculated Scientific Data:
      - Lift Coefficient (Cl): ${physicsData.liftCoefficient.toFixed(3)}
      - Drag Coefficient (Cd): ${physicsData.dragCoefficient.toFixed(3)}
      - Reynolds Number: ${physicsData.reynoldsNumber.toExponential(2)}
      - Angle of Attack: ${alpha} degrees

      Task:
      1. Explain the flow regime (Laminar/Turbulent) based on the Reynolds number.
      2. Analyze the efficiency (L/D ratio).
      3. Identify if the object is likely in a stall condition based on the Cl and Angle.
      4. Provide engineering recommendations to improve performance.

      Keep the explanation technical but concise (max 3 sentences for explanation).
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { parts: [{ text: prompt }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            explanation: { type: Type.STRING },
            recommendations: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["explanation", "recommendations"]
        }
      },
    });

    const resultText = response.text;
    if (!resultText) throw new Error("No response from AI");

    return JSON.parse(resultText);

  } catch (error) {
    console.error("Error explaining simulation:", error);
    return {
      explanation: "Analysis currently unavailable. The physics calculations are accurate, but the expert explanation service is offline.",
      recommendations: ["Check Reynolds number manually.", "Verify angle of attack is within linear range."]
    };
  }
};
