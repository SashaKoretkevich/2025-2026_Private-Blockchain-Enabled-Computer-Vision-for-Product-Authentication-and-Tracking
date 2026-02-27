
import subprocess
from datetime import datetime

CONTRACT = "Contracts/ProductRegistry.sol"
OUTPUT_FILE = f"analysis_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"


def run_tool(tool_name, command):
    print(f"Running {tool_name}...")
    
    try:
        result = subprocess.run(command, capture_output=True, text=True)
        return f"\n {tool_name.upper()}\n\n{result.stdout}\n{result.stderr}\n"
    except FileNotFoundError:
        return f"\n{tool_name} not found. Please install it.\n"


def main():
    print(f"Analyzing: {CONTRACT}")
    
    slither_output = run_tool("Slither", ["slither", CONTRACT])
    solhint_output = run_tool("Solhint", ["solhint", CONTRACT])
    
    full_output = f"""
SOLIDITY ANALYSIS REPORT
Contract: {CONTRACT}
Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
{slither_output}
{solhint_output}
"""
    
    with open(OUTPUT_FILE, 'w') as f:
        f.write(full_output)
    
    print(f"\n✓ Analysis saved to: {OUTPUT_FILE}\n")


if __name__ == "__main__":
    main()