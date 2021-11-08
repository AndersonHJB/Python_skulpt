/*
* @Author: Anderson
* @Date:   2021-01-22 11:53:18
* @Last Modified by:   Anderson
* @Last Modified time: 2021-01-22 13:39:56
*/
errors_info = [
    {
        'error_msg': 'SyntaxError: invalid character in identifier',
        'possible_reason': '语法错误：存在非法字符',
        'solution': '检查是否存在中文符号？'
    }
]

function check_output_error(output) {
    if (RegExp('File "/tmp/user_files/\\d+/main.py"', "g").exec(output)) {
        line = parseInt(/, line (\d+)/g.exec(output)[1]) - 1;
        for (var i = 0; i < errors_info.length; i++) {
            var error_info = errors_info[i];
            if (output.indexOf(error_info['error_msg']) != -1) {
                return {
                    'error': true,
                    'msg': error_info['possible_reason'] + '\n' + `在第${line}行，${error_info['solution']}`
                }
            }
        }
        return {
            'error': true,
            'msg': output.replace(RegExp('File "/tmp/user_files/\\d+/main.py", ', "g"), '')
        }
    } else {
        return {
            'error': false,
        }
    }
}