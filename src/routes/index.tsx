import { component$, useSignal, $, useVisibleTask$ } from '@builder.io/qwik';
import type { DocumentHead } from '@builder.io/qwik-city';
import { ethers } from 'ethers';
import { LuShare2, LuExternalLink } from '@qwikest/icons/lucide';

export default component$(() => {
  const contractAddress = useSignal('');
  const contractResult = useSignal('');
  const isLoading = useSignal(false);
  const error = useSignal('');
  const isTyping = useSignal(false);
  const shareUrl = useSignal('');

  // 提取读取逻辑为独立函数
  const executeRead = $(async (address: string) => {
    if (!address.trim()) {
      error.value = 'Please enter a contract address';
      return;
    }

    // 验证地址格式
    if (!ethers.isAddress(address)) {
      error.value = 'Invalid contract address format, please check and try again';
      return;
    }

    isLoading.value = true;
    error.value = '';
    contractResult.value = '';

    try {
      const ALCHEMY_KEY = import.meta.env.PUBLIC_ALCHEMY_API_KEY || 'demo';
      const provider = new ethers.JsonRpcProvider(`https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`);
      
      const code = await provider.getCode(address);
      
      if (code === '0x') {
        error.value = 'This address is not a contract or does not exist';
        isLoading.value = false;
        return;
      }

      const ETHERSCAN_API_KEY = import.meta.env.PUBLIC_ETHERSCAN_API_KEY || '';
      const etherscanUrl = `https://api.etherscan.io/v2/api?chainid=11155111&module=contract&action=getabi&address=${address}${ETHERSCAN_API_KEY ? '&apikey=' + ETHERSCAN_API_KEY : ''}`;

      const response = await fetch(etherscanUrl);
      const data = await response.json();

      if (data.status !== '1' || !data.result) {
        error.value = 'Contract not verified on Etherscan.\n\nPlease verify your contract first.';
        isLoading.value = false;
        return;
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
        error.value = 'No message found in this contract.';
        isLoading.value = false;
        return;
      }

      const func = stringFunctions[0];
      const result = await contract[func.name]();

      // 生成分享链接
      shareUrl.value = `${window.location.origin}${window.location.pathname}?address=${address}`;

      // 打字机效果
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

  // 按钮点击时调用
  const readContract = $(async () => {
    await executeRead(contractAddress.value);
  });

  // 页面加载时从 URL 读取地址并自动执行
  useVisibleTask$(async () => {
    const params = new URLSearchParams(window.location.search);
    const address = params.get('address');
    if (address) {
      contractAddress.value = address;
      await executeRead(address);
    }
  });

  // 复制分享链接
  const copyShareLink = $(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl.value);
      alert('Share link copied!');
    } catch (err) {
      alert('Failed to copy link');
    }
  });

  // 在 Etherscan 查看
  const viewOnEtherscan = $(() => {
    const url = `https://sepolia.etherscan.io/address/${contractAddress.value}`;
    window.open(url, '_blank');
  });

  return (
    <div class="min-h-screen bg-gradient-to-br from-gray-100 via-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div class="w-full max-w-3xl">
        {/* 标题 */}
        <div class="text-center mb-8">
          <h1 class="text-5xl font-bold text-gray-900 mb-3 tracking-tight">
            Message Reader
          </h1>
          <p class="text-gray-600 text-base max-w-2xl mx-auto">
            Sadly, blockchain explorers often fail to properly display messages — truncating text, breaking emojis, and ignoring line breaks. That's why I built this tool.
          </p>
        </div>

        {/* 输入框 */}
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

        {/* 错误信息 */}
        {error.value && (
          <div class="mb-6 p-4 bg-red-50/70 backdrop-blur-xl border border-red-100 rounded-2xl text-red-700 text-sm whitespace-pre-wrap shadow-lg">
            {error.value}
          </div>
        )}

        {/* 结果显示区域 */}
        {contractResult.value && (
          <div class="bg-white/50 backdrop-blur-2xl rounded-2xl p-6 border border-white/80 relative shadow-xl mb-6">
            {/* 右上角按钮组 */}
            <div class="absolute top-4 right-4 flex gap-2">
              {/* Etherscan 查看按钮 */}
              <button
                onClick$={viewOnEtherscan}
                class="p-2.5 bg-white/60 hover:bg-white/80 backdrop-blur-xl rounded-xl transition-all"
                title="View on Etherscan"
              >
                <LuExternalLink class="w-4.5 h-4.5 text-gray-700" />
              </button>
              
              {/* 分享按钮 */}
              <button
                onClick$={copyShareLink}
                class="p-2.5 bg-white/60 hover:bg-white/80 backdrop-blur-xl rounded-xl transition-all"
                title="Copy share link"
              >
                <LuShare2 class="w-4.5 h-4.5 text-gray-700" />
              </button>
            </div>

            <pre class="text-gray-800 whitespace-pre-wrap break-words leading-relaxed font-mono text-sm pr-20">
{contractResult.value}{isTyping.value && <span class="animate-blink">|</span>}
            </pre>
          </div>
        )}

        {/* 示例 */}
        <div class="text-center">
          <p class="text-gray-500 text-sm mb-3">Try an example:</p>
          <button
            onClick$={() => {
              contractAddress.value = '0xDdA7C517b333bb30EB20581929738Cf47A02149b';
            }}
            class="px-4 py-2.5 bg-white/60 hover:bg-white/70 backdrop-blur-xl text-gray-700 text-sm rounded-xl transition-all border border-white/80 shadow-lg"
          >
            ?
          </button>
        </div>

        {/* 底部 */}
        <div class="text-center mt-8 text-gray-500 text-sm">
          <p>Powered by Qwik + Ethers.js</p>
          <p class="text-xs mt-1 text-gray-400">
            Currently supports verified contracts on Sepolia network with a single string-returning view function.
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