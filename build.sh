# exit when any command fails
set -e

# For local setups make sure emcc is activated:
# $ ./emsdk/emsdk activate
# source "./emsdk/emsdk_env.sh"

# Copy to bls-eth-wasm to prevent causing git differences
rm -rf bls-eth-wasm
cp -r -T bls-eth-wasm-upstream bls-eth-wasm

# Build herumi's C lib with emcc
rm -f bls-eth-wasm/bls_c.js && rm -f bls-eth-wasm/bls_c.wasm
cd bls && make clean && make bls-eth-wasm && cd ..

# Add types
cp types/* bls-eth-wasm/

# Rename dir to dist for publishing to NPM
rm -rf dist/
cp -r -T bls-eth-wasm/ dist/
