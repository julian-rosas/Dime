import json
from transformers import AutoTokenizer, AutoModelForCausalLM
from peft import PeftModel
import torch

WEIGHTS_PATH = "./LLM/weights"
BASE_MODEL   = "Qwen/Qwen2.5-1.5B-Instruct"

SYSTEM_PROMPT = (
    "Eres un clasificador y extractor de intents financieros "
    "para una app conversacional inclusiva en México. "
    "Responde únicamente con un objeto JSON válido. "
    "No expliques nada. "
    "No uses markdown. "
    "No agregues texto antes ni después del JSON. "
    "Usa siempre esta estructura exacta: "
    '{"intent": string, "amount": number | null, "currency": string | null, '
    '"recipient_name": string | null, "needs_confirmation": boolean, '
    '"missing_fields": array, "risk_flags": array}.'
)

class QwenModel:
    _instance = None  # singleton para no cargar el modelo dos veces

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._load()
        return cls._instance

    def _load(self):
        print("Cargando modelo base...")
        self.tokenizer = AutoTokenizer.from_pretrained(
            WEIGHTS_PATH,
            trust_remote_code=True,
        )
        base = AutoModelForCausalLM.from_pretrained(
            BASE_MODEL,
            dtype=torch.float16,
            device_map="auto",
            trust_remote_code=True,
        )
        print("Cargando adaptadores LoRA...")
        self.model = PeftModel.from_pretrained(base, WEIGHTS_PATH)
        self.model.eval()
        print("Modelo listo.")

    def predict(self, user_message: str) -> dict:
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user",   "content": user_message},
        ]
        templated = self.tokenizer.apply_chat_template(
            messages,
            tokenize=True,
            add_generation_prompt=True,
            return_tensors="pt",
            return_dict=True,
        )

        input_ids = templated["input_ids"].to(self.model.device)

        if "attention_mask" in templated and templated["attention_mask"] is not None:
            attention_mask = templated["attention_mask"].to(self.model.device)
        elif self.tokenizer.pad_token_id is None:
            attention_mask = torch.ones_like(input_ids, dtype=torch.long)
        else:
            attention_mask = (input_ids != self.tokenizer.pad_token_id).long()

        with torch.no_grad():
            outputs = self.model.generate(
                input_ids=input_ids,
                attention_mask=attention_mask,
                max_new_tokens=128,
                do_sample=False,
                pad_token_id=self.tokenizer.eos_token_id,
            )

        input_len = input_ids.shape[1]
        response  = self.tokenizer.decode(
            outputs[0][input_len:],
            skip_special_tokens=True,
        )

        try:
            return json.loads(response)
        except json.JSONDecodeError:
            return {"error": "respuesta no válida", "raw": response}
