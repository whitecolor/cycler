#!/bin/bash
set -e

PRODUCTION_FLAG=""
LINKLOCAL_CMD=""

LOCKFILE=.install-deps.lock
DEPSFILE=yarn.lock
EXCLUDE_FOLDERS="node_modules"
ROOT=$PWD

touch $LOCKFILE

echo "Install dependencies: start, lock file created"

if [[ "$@" == *"--production"* ]]
then
  echo "Install dependencies: with production flat"
  PRODUCTION_FLAG="--production"
fi

if [[ "$@" == *"--linklocal"* ]]
then
echo "Install dependencies: using linklocal"
  LINKLOCAL_CMD="linklocal && "
fi


for f in $(ls $DEPSFILE */$DEPSFILE */*/$DEPSFILE */*/*/$DEPSFILE | grep -v "$EXCLUDE_FOLDERS"); do
  d=$(dirname "${f}")
  echo "Installing dependencies in $ROOT/$d..."
  cd "$ROOT/$d"  
  sh -c "$LINKLOCAL_CMD yarn --ignore-engines $PRODUCTION_FLAG"
done

cd $ROOT
rm $LOCKFILE

echo "Install dependencies: finish"