import sys
import os
import subprocess

def parse_agent_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if content.startswith('---'):
        parts = content.split('---', 2)
        # simplistic frontmatter parsing
        meta = {}
        for line in parts[1].split('\n'):
            if ':' in line:
                k, v = line.split(':', 1)
                meta[k.strip()] = v.strip()
        system_prompt = parts[2].strip()
        return meta, system_prompt
    return {}, content

def run_agent(agent_file, task_prompt):
    meta, system_prompt = parse_agent_file(agent_file)
    
    cwd = os.getcwd()
    full_prompt = f"{system_prompt}\n\n=== CONTEXT ===\nYour working directory is: {cwd}\nAll paths must be relative to this directory.\n\n=== TASK ===\n{task_prompt}"
    
    print(f"Starting agy subagent: {meta.get('name', 'Unknown')}")
    try:
        # Run agy in headless mode. 
        # --dangerously-skip-permissions ensures it can run bash/read/write without human prompts.
        # -p prints the response to stdout and exits.
        os.environ["PYTHONIOENCODING"] = "utf-8"
        
        # In case the python script is called from another dir, make sure CWD is correct
        cwd = os.getcwd()
        
        result = subprocess.run(
            ["agy", "--dangerously-skip-permissions", "-p", full_prompt],
            cwd=cwd,
            capture_output=True,
            text=True,
            encoding='utf-8',
            timeout=600 # 10 mins timeout
        )
        
        if result.returncode != 0:
            print(f"agy error: {result.stderr}")
            return f"Agent failed: {result.stderr}"
            
        return result.stdout
    except Exception as e:
        return f"Error running agy subagent: {str(e)}"

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python ag_agent.py <agent_file_path> <task_prompt>")
        sys.exit(1)
    
    agent_path = sys.argv[1]
    task_prompt = sys.argv[2]
    result = run_agent(agent_path, task_prompt)
    print(result)
