import { env, AutoTokenizer, AutoModelForSequenceClassification } from '@huggingface/transformers';

env.allowRemoteModels = true;

async function testRerank() {
    const modelId = 'Xenova/bge-reranker-base';
    console.log('Loading tokenizer...');
    const tokenizer = await AutoTokenizer.from_pretrained(modelId);
    console.log('Loading model...');
    const model = await AutoModelForSequenceClassification.from_pretrained(modelId, { dtype: 'fp32' });

    const query = "What is CowController?";
    const docs = [
        "The CowController script manages the physical movement of the cow entity in the game.",
        "Dentistry module uses a UI canvas to show patient selections.",
        "CowController is responsible for jumping and animations."
    ];

    console.log('Tokenizing...');
    const inputs = tokenizer(
        new Array(docs.length).fill(query), 
        { text_pair: docs, padding: true, truncation: true }
    );
    
    console.log('Inferencing...');
    const outputs = await model(inputs);
    console.log(outputs.logits.data);
}

testRerank().catch(console.error);
