#!/bin/bash
cd ~/silk
git remote update
UPSTREAM=${1:-'@{u}'}
LOCAL=$(git rev-parse @)
REMOTE=$(git rev-parse "$UPSTREAM")
BASE=$(git merge-base @ "$UPSTREAM")
if [ $LOCAL = $REMOTE ]; then
    	echo "Silk is up to date."
elif [ $LOCAL = $BASE ]; then
    	echo "Updating..."
	git pull
	pnpm build
	echo "Silk Has been Updated"
fi
