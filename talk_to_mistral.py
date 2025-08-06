import subprocess

def stream_local_ai(prompt, model="mistral"):
    cmd = ["ollama", "run", model, prompt]
    process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)

    print("\n--- Hexcarb AI Says ---\n")
    for line in process.stdout:
        print(line, end="")  # Print without adding extra newlines

if __name__ == "__main__":
    while True:
        question = input("\nAsk Hexcarb AI (or type 'exit' to quit): ")
        if question.lower() == "exit":
            break
        stream_local_ai(question)
