export default function (array = [], limit = 0, reversed = false) {
    array.reversed = reversed;
    array.limit = limit;

    array.add = (element) => {
        if (array.limit > 0 && array.length >= array.limit) {
            if (array.reversed) {
                array.splice(array.length - 1, 1);
            } else {
                array.splice(0, 1);
            }
        }

        if (array.reversed) {
            array.reverse()
            array.push(element);
            array.reverse();
        } else {
            array.push(element);
        }
    }

    return array;
}