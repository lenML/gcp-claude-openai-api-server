#!/bin/bash

set -e

DATE=$(date +"%Y%m%d")
COMMIT_HASH=$(git rev-parse --short HEAD)
ROOT_DIR=$(pwd)

rm -rf ./output
rm -rf gcoas_*.zip
npm run build

platforms=("windows" "linux" "mac")


for platform in "${platforms[@]}"
do
    cd $ROOT_DIR
    npm run build:$platform
    cd $ROOT_DIR/output/$platform
    cp $ROOT_DIR/README.md .
    zip -r "gcoas_${platform}_${DATE}_${COMMIT_HASH}.zip" *
    mv "gcoas_${platform}_${DATE}_${COMMIT_HASH}.zip" $ROOT_DIR
    # rm -rf output/$platform
done

# rm -rf ./output