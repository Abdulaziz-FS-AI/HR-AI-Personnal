# AI Model Analysis for HR Resume Screening

## Model Options Research

### Open Source Options
1. **Llama 3.1** ⭐ **RECOMMENDED**
   - **Cost**: $0.10-$0.90 per million tokens (50% cheaper than GPT-4)
   - **Performance**: Approaching GPT-4 levels on most benchmarks
   - **Advantage**: Full control, customizable, bias mitigation possible
   - **Deployment**: API access or self-hosting options

2. **Available Datasets**
   - Kaggle: "AI-Powered Resume Screening Dataset (2025)"
   - GitHub: Multiple open-source resume analysis projects
   - **Risk**: Need to validate for bias and accuracy

### Commercial Options
1. **OpenAI GPT-4**
   - **Cost**: $30/1M input tokens, $60/1M output tokens
   - **Performance**: Superior reasoning for complex analysis
   - **Advantage**: Proven reliability, consistent updates
   - **Limitation**: Higher cost, less customization

## Cost Analysis for Pay-Per-Resume Model

### Estimated Token Usage Per Resume
- Average resume: ~1,500 words = ~2,000 tokens
- Job description + questions: ~500 tokens  
- AI analysis output: ~800 tokens
- **Total per resume**: ~3,300 tokens

### Cost Per Resume Analysis
- **Llama 3.1**: $0.001-$0.003 per resume
- **GPT-4**: $0.30 per resume

### Pricing Strategy Implications
With Llama 3.1, we can charge $2-5 per resume and maintain 80%+ margins
With GPT-4, we'd need to charge $3-8 per resume for similar margins

## Recommendation: Hybrid Approach

**Phase 1 (MVP)**: Start with Llama 3.1 API
- Lower costs enable competitive pricing
- Good performance for basic analysis
- Faster iteration and customization

**Phase 2 (Scale)**: Add GPT-4 as premium option
- "Standard Analysis" (Llama) vs "Premium Analysis" (GPT-4)
- Let customers choose based on budget/needs

## Bias Mitigation Strategy
- Use diverse training datasets
- Implement bias detection algorithms
- Regular auditing of analysis results
- Transparent scoring methodology