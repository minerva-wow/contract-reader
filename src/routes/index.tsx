import { component$, useSignal, $, useVisibleTask$ } from '@builder.io/qwik';
import type { DocumentHead } from '@builder.io/qwik-city';
import { server$ } from '@builder.io/qwik-city';
import { ethers } from 'ethers';
import { LuShare2, LuExternalLink, LuCheck, LuX } from '@qwikest/icons/lucide';

// Server-side function - runs only on the server
const readContractOnServer = server$(async function(address: string) {
  const ALCHEMY_KEY = this.env.get('PUBLIC_ALCHEMY_API_KEY') || 'demo';
  const provider = new ethers.JsonRpcProvider(`https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`);
  
  const code = await provider.getCode(address);
  
  if (code === '0x') {
    throw new Error('This address is not a contract or does not exist');
  }

  const ETHERSCAN_API_KEY = this.env.get('PUBLIC_ETHERSCAN_API_KEY') || '';
  const etherscanUrl = `https://api.etherscan.io/v2/api?chainid=1&module=contract&action=getabi&address=${address}${ETHERSCAN_API_KEY ? '&apikey=' + ETHERSCAN_API_KEY : ''}`;

  const response = await fetch(etherscanUrl);
  const data = await response.json();

  if (data.status !== '1' || !data.result) {
    throw new Error('Contract not verified on Etherscan.\n\nPlease verify your contract first.');
  }

  const abi = JSON.parse(data.result);
  const contract = new ethers.Contract(address, abi, provider);

  const stringFunctions = abi.filter((item: any) => 
    item.type === 'function' && 
    (item.stateMutability === 'view' || item.stateMutability === 'pure') &&
    item.inputs.length === 0 &&
    item.outputs?.length === 1 &&
    item.outputs[0].type === 'string'
  );

  if (stringFunctions.length === 0) {
    throw new Error('No message found in this contract.');
  }

  const func = stringFunctions[0];
  const result = await contract[func.name]();
  
  return result;
});

export default component$(() => {
  const contractAddress = useSignal('');
  const contractResult = useSignal('');
  const isLoading = useSignal(false);
  const error = useSignal('');
  const isTyping = useSignal(false);
  const shareUrl = useSignal('');
  const copyStatus = useSignal<'idle' | 'success' | 'failed'>('idle');

  // Client-side function that calls the server function
  const executeRead = $(async (address: string) => {
    if (!address.trim()) {
      error.value = 'Please enter a contract address';
      return;
    }

    // Validate address format
    if (!ethers.isAddress(address)) {
      error.value = 'Invalid contract address format, please check and try again';
      return;
    }

    isLoading.value = true;
    error.value = '';
    contractResult.value = '';

    try {
      // Call server-side function
      const result = await readContractOnServer(address);

      // Generate share URL
      shareUrl.value = `${window.location.origin}${window.location.pathname}?address=${address}`;

      // Typewriter effect
      isTyping.value = true;
      const chars = result.split('');
      contractResult.value = '';
      
      for (let i = 0; i < chars.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 30));
        contractResult.value += chars[i];
      }
      
      isTyping.value = false;
      
    } catch (err: any) {
      error.value = err.message || 'Failed to read contract';
    } finally {
      isLoading.value = false;
    }
  });

  // Button click handler
  const readContract = $(async () => {
    await executeRead(contractAddress.value);
  });

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async () => {
    const params = new URLSearchParams(window.location.search);
    const address = params.get('address');
    if (address) {
      contractAddress.value = address;
      await executeRead(address);
    }
  });

  // Copy share link
  const copyShareLink = $(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl.value);
      copyStatus.value = 'success';
      // Reset after 2 seconds
      setTimeout(() => {
        copyStatus.value = 'idle';
      }, 2000);
    } catch {
      copyStatus.value = 'failed';
      // Reset after 2 seconds
      setTimeout(() => {
        copyStatus.value = 'idle';
      }, 2000);
    }
  });

  // View on Etherscan
  const viewOnEtherscan = $(() => {
    const url = `https://etherscan.io/address/${contractAddress.value}`;
    window.open(url, '_blank');
  });

  return (
    <div class="min-h-screen bg-linear-to-br from-gray-100 via-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div class="w-full max-w-3xl">
        {/* Title */}
        <div class="text-center mb-8">
          <h1 class="text-5xl font-bold text-gray-900 mb-3 tracking-tight">
            Message Reader
          </h1>
          <p class="text-gray-600 text-base max-w-2xl mx-auto">
            Sadly, blockchain explorers often fail to properly display messages — truncating text, breaking emojis, and ignoring line breaks. That's why I built this tool.
          </p>
        </div>

        {/* Input */}
        <div class="flex gap-3 mb-6">
          <input
            type="text"
            value={contractAddress.value}
            onInput$={(e) => {
              contractAddress.value = (e.target as HTMLInputElement).value;
              error.value = '';
            }}
            onKeyPress$={(e) => {
              if (e.key === 'Enter') {
                readContract();
              }
            }}
            placeholder="Contract address (0x...)"
            class="flex-1 bg-white/60 backdrop-blur-xl text-gray-800 px-5 py-3.5 rounded-2xl border border-white/80 focus:border-gray-300 focus:outline-none focus:bg-white/70 transition-all placeholder:text-gray-400 shadow-lg"
          />
          <button
            onClick$={readContract}
            disabled={isLoading.value}
            class="px-8 py-3.5 bg-white/70 backdrop-blur-xl hover:bg-white/80 text-gray-800 rounded-2xl transition-all disabled:opacity-40 disabled:cursor-not-allowed border border-white/80 font-medium shadow-lg"
          >
            {isLoading.value ? 'Reading...' : 'Read'}
          </button>
        </div>

        {/* Error message */}
        {error.value && (
          <div class="mb-6 p-4 bg-red-50/70 backdrop-blur-xl border border-red-100 rounded-2xl text-red-700 text-sm whitespace-pre-wrap shadow-lg">
            {error.value}
          </div>
        )}

        {/* Result display area */}
        {contractResult.value && (
          <div class="bg-white/50 backdrop-blur-2xl rounded-2xl p-6 border border-white/80 relative shadow-xl mb-6">
            {/* Top-right button group */}
            <div class="absolute top-4 right-4 flex gap-2">
              {/* View on Etherscan button */}
              <button
                onClick$={viewOnEtherscan}
                class="p-2.5 bg-white/60 hover:bg-white/80 backdrop-blur-xl rounded-xl transition-all"
                title="View on Etherscan"
              >
                <LuExternalLink class="w-4.5 h-4.5 text-gray-700" />
              </button>
              
              {/* Share button */}
              <button
                onClick$={copyShareLink}
                class="p-2.5 bg-white/60 hover:bg-white/80 backdrop-blur-xl rounded-xl transition-all"
                title={
                  copyStatus.value === 'success' 
                    ? 'Copied!' 
                    : copyStatus.value === 'failed'
                    ? 'Copy failed'
                    : 'Copy share link'
                }
              >
                {copyStatus.value === 'success' ? (
                  <LuCheck class="w-4.5 h-4.5 text-gray-700" />
                ) : copyStatus.value === 'failed' ? (
                  <LuX class="w-4.5 h-4.5 text-gray-700" />
                ) : (
                  <LuShare2 class="w-4.5 h-4.5 text-gray-700" />
                )}
              </button>
            </div>

            <pre class="text-gray-800 whitespace-pre-wrap wrap-break-word leading-relaxed font-mono text-sm pr-20">
{contractResult.value}{isTyping.value && <span class="animate-blink">|</span>}
            </pre>
          </div>
        )}

        {/* Example */}
        <div class="text-center">
          <p class="text-gray-500 text-sm mb-3">Try an example:</p>
          <button
            onClick$={() => {
              contractAddress.value = '0x01C768D9B8FfCb83DC95dB0EF5c7BbE8564816ca';
            }}
            class="px-4 py-2.5 bg-white/60 hover:bg-white/70 backdrop-blur-xl text-gray-700 text-sm rounded-xl transition-all border border-white/80 shadow-lg"
          >
            ?
          </button>
        </div>

        {/* Footer */}
        <div class="text-center mt-8 text-gray-500 text-sm">
          <p>Powered by Qwik + Ethers.js</p>
          <p class="text-xs mt-1 text-gray-400">
            Currently supports verified contracts on Ethereum Mainnet with a single string-returning view function.
          </p>
        </div>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: 'Message Reader - Read Blockchain Messages',
  meta: [
    {
      name: 'description',
      content: 'Read on-chain messages with proper emoji and formatting support',
    },
  ],
};